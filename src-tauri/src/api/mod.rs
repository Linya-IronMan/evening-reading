pub mod books;
pub mod tts;
pub mod ws;

use axum::{
    routing::{get, post, put, delete},
    Router,
    response::IntoResponse,
    http::{header, Uri, StatusCode},
};
use tower_http::cors::{CorsLayer, Any};
use rust_embed::RustEmbed;
use axum::extract::DefaultBodyLimit;
use crate::db::AppState;

#[derive(RustEmbed)]
#[folder = "../dist"]
struct Asset;

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let mut path = uri.path().trim_start_matches('/').to_string();
    if path.is_empty() {
        path = "index.html".to_string();
    }
    match Asset::get(path.as_str()) {
        Some(content) => {
            let mime = mime_guess::from_path(&path).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            if let Some(content) = Asset::get("index.html") {
                let mime = mime_guess::from_path("index.html").first_or_octet_stream();
                ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
            } else {
                StatusCode::NOT_FOUND.into_response()
            }
        }
    }
}

async fn health_check() -> impl IntoResponse {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/json")],
        r#"{"status":"ok","message":"healthy"}"#,
    )
}

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_origin(Any);

    Router::new()
        // Health check
        .route("/api/health", get(health_check))
        // Book metadata
        .route("/api/books", get(books::list_books).post(books::import_book))
        .route("/api/books/:id", delete(books::delete_book))
        // Book content blocks
        .route("/api/books/:id/blocks", get(books::get_blocks).put(books::update_blocks))
        // Reading progress
        .route("/api/books/:id/progress", get(books::get_progress).put(books::update_progress))
        // Comments
        .route("/api/books/:id/comments", get(books::get_comments).post(books::create_comment))
        .route("/api/books/:id/comments/:comment_id", put(books::update_comment).delete(books::delete_comment))
        // TTS
        .route("/api/tts", post(tts::handle_tts))
        // WebSocket
        .route("/api/ws", get(ws::ws_handler))
        // Serve static files for SPA
        .fallback(static_handler)
        .layer(DefaultBodyLimit::max(100 * 1024 * 1024)) // 100MB limit for large book imports
        .layer(cors)
        .with_state(state)
}
