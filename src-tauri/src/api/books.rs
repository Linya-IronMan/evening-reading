use axum::{
    extract::{Path, State, Json},
    http::StatusCode,
};
use crate::db::AppState;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Chapter {
    pub title: String,
    #[serde(rename = "blockId")]
    pub block_id: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Book {
    pub id: String,
    pub title: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "totalBlocks")]
    pub total_blocks: u32,
    pub chapters: Option<Vec<Chapter>>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ParagraphBlock {
    pub id: String,
    #[serde(rename = "bookId")]
    pub book_id: String,
    pub index: u32,
    pub content: String,
    pub version: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ReadingProgress {
    #[serde(rename = "bookId")]
    pub book_id: String,
    #[serde(rename = "currentBlockId")]
    pub current_block_id: String,
    #[serde(rename = "playbackSpeed")]
    pub playback_speed: f64,
    #[serde(rename = "voiceId")]
    pub voice_id: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Comment {
    pub id: String,
    #[serde(rename = "bookId")]
    pub book_id: String,
    #[serde(rename = "blockId")]
    pub block_id: String,
    #[serde(rename = "startOffset")]
    pub start_offset: u32,
    #[serde(rename = "endOffset")]
    pub end_offset: u32,
    #[serde(rename = "quoteText")]
    pub quote_text: String,
    pub content: String,
    #[serde(rename = "isOrphaned")]
    pub is_orphaned: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

// POST /api/books
#[derive(Deserialize)]
pub struct ImportBookPayload {
    pub book: Book,
    pub blocks: Vec<ParagraphBlock>,
}

pub async fn import_book(
    State(state): State<AppState>,
    Json(payload): Json<ImportBookPayload>,
) -> Result<StatusCode, StatusCode> {
    tokio::task::spawn_blocking(move || {
        let mut conn = state.db.lock().unwrap();
        let tx = conn.transaction().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let chapters_json = payload.book.chapters.as_ref().map(|c| serde_json::to_string(c).unwrap_or_default());
        
        tx.execute(
            "INSERT OR REPLACE INTO books (id, title, file_name, total_blocks, chapters, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (
                &payload.book.id,
                &payload.book.title,
                &payload.book.file_name,
                &payload.book.total_blocks,
                chapters_json,
                &payload.book.created_at,
                &payload.book.updated_at,
            ),
        ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        for block in payload.blocks {
            tx.execute(
                "INSERT OR REPLACE INTO blocks (book_id, id, idx, content, version) VALUES (?1, ?2, ?3, ?4, ?5)",
                (&block.book_id, &block.id, &block.index, &block.content, &block.version),
            ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }

        tx.commit().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        Ok(StatusCode::OK)
    }).await.unwrap_or(Err(StatusCode::INTERNAL_SERVER_ERROR))
}

pub async fn list_books(State(state): State<AppState>) -> Result<Json<Vec<Book>>, StatusCode> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, title, file_name, total_blocks, chapters, created_at, updated_at FROM books ORDER BY updated_at DESC").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let books_iter = stmt.query_map([], |row| {
        let chapters_str: Option<String> = row.get(4)?;
        let chapters = chapters_str.and_then(|s| serde_json::from_str(&s).ok());
        Ok(Book {
            id: row.get(0)?,
            title: row.get(1)?,
            file_name: row.get(2)?,
            total_blocks: row.get(3)?,
            chapters,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    }).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut books = Vec::new();
    for book in books_iter {
        if let Ok(b) = book {
            books.push(b);
        }
    }
    Ok(Json(books))
}

pub async fn delete_book(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, StatusCode> {
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM books WHERE id = ?1", [&id]).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    conn.execute("DELETE FROM blocks WHERE book_id = ?1", [&id]).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    conn.execute("DELETE FROM progress WHERE book_id = ?1", [&id]).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    conn.execute("DELETE FROM comments WHERE book_id = ?1", [&id]).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

pub async fn get_blocks(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Vec<ParagraphBlock>>, StatusCode> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, book_id, idx, content, version FROM blocks WHERE book_id = ?1 ORDER BY idx ASC").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let blocks_iter = stmt.query_map([&id], |row| {
        Ok(ParagraphBlock {
            id: row.get(0)?,
            book_id: row.get(1)?,
            index: row.get(2)?,
            content: row.get(3)?,
            version: row.get(4)?,
        })
    }).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut blocks = Vec::new();
    for block in blocks_iter {
        if let Ok(b) = block {
            blocks.push(b);
        }
    }
    Ok(Json(blocks))
}

pub async fn update_blocks(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(blocks): Json<Vec<ParagraphBlock>>,
) -> Result<StatusCode, StatusCode> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    for block in blocks {
        if block.book_id == id {
            tx.execute(
                "UPDATE blocks SET content = ?1, version = ?2 WHERE book_id = ?3 AND id = ?4",
                (&block.content, &block.version, &block.book_id, &block.id),
            ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }
    tx.commit().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

pub async fn get_progress(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Option<ReadingProgress>>, StatusCode> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT book_id, current_block_id, playback_speed, voice_id, updated_at FROM progress WHERE book_id = ?1").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut rows = stmt.query([&id]).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if let Some(row) = rows.next().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        Ok(Json(Some(ReadingProgress {
            book_id: row.get(0).unwrap(),
            current_block_id: row.get(1).unwrap(),
            playback_speed: row.get(2).unwrap(),
            voice_id: row.get(3).unwrap_or(None),
            updated_at: row.get(4).unwrap(),
        })))
    } else {
        Ok(Json(None))
    }
}

pub async fn update_progress(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(progress): Json<ReadingProgress>,
) -> Result<StatusCode, StatusCode> {
    let conn = state.db.lock().unwrap();
    if progress.book_id != id {
        return Err(StatusCode::BAD_REQUEST);
    }
    conn.execute(
        "INSERT OR REPLACE INTO progress (book_id, current_block_id, playback_speed, voice_id, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        (&progress.book_id, &progress.current_block_id, &progress.playback_speed, &progress.voice_id, &progress.updated_at),
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let event = serde_json::to_string(&crate::api::ws::SyncEvent {
        event_type: "SYNC_PROGRESS".to_string(),
        book_id: id,
    }).unwrap_or_default();
    let _ = state.tx.send(event);

    Ok(StatusCode::OK)
}

pub async fn get_comments(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Comment>>, StatusCode> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, book_id, block_id, start_offset, end_offset, quote_text, content, is_orphaned, created_at FROM comments WHERE book_id = ?1 ORDER BY created_at DESC").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let comments_iter = stmt.query_map([&id], |row| {
        let is_orphaned_int: i32 = row.get(7)?;
        Ok(Comment {
            id: row.get(0)?,
            book_id: row.get(1)?,
            block_id: row.get(2)?,
            start_offset: row.get(3)?,
            end_offset: row.get(4)?,
            quote_text: row.get(5)?,
            content: row.get(6)?,
            is_orphaned: Some(is_orphaned_int != 0),
            created_at: row.get(8)?,
        })
    }).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut comments = Vec::new();
    for comment in comments_iter {
        if let Ok(c) = comment {
            comments.push(c);
        }
    }
    Ok(Json(comments))
}

pub async fn create_comment(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(comment): Json<Comment>,
) -> Result<StatusCode, StatusCode> {
    let conn = state.db.lock().unwrap();
    if comment.book_id != id {
        return Err(StatusCode::BAD_REQUEST);
    }
    let is_orphaned_int = if comment.is_orphaned.unwrap_or(false) { 1 } else { 0 };
    conn.execute(
        "INSERT INTO comments (id, book_id, block_id, start_offset, end_offset, quote_text, content, is_orphaned, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        (&comment.id, &comment.book_id, &comment.block_id, &comment.start_offset, &comment.end_offset, &comment.quote_text, &comment.content, &is_orphaned_int, &comment.created_at),
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let event = serde_json::to_string(&crate::api::ws::SyncEvent {
        event_type: "SYNC_COMMENTS".to_string(),
        book_id: id,
    }).unwrap_or_default();
    let _ = state.tx.send(event);

    Ok(StatusCode::OK)
}

pub async fn delete_comment(
    Path((book_id, comment_id)): Path<(String, String)>,
    State(state): State<AppState>,
) -> Result<StatusCode, StatusCode> {
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM comments WHERE book_id = ?1 AND id = ?2", [&book_id, &comment_id]).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let event = serde_json::to_string(&crate::api::ws::SyncEvent {
        event_type: "SYNC_COMMENTS".to_string(),
        book_id: book_id,
    }).unwrap_or_default();
    let _ = state.tx.send(event);
    
    Ok(StatusCode::OK)
}
