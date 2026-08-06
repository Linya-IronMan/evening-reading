use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use crate::db::AppState;

#[derive(Serialize, Deserialize)]
pub struct SyncEvent {
    pub event_type: String, // "SYNC_PROGRESS", "SYNC_BLOCKS", "SYNC_COMMENTS"
    pub book_id: String,
}

pub async fn ws_handler(State(state): State<AppState>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut rx = state.tx.subscribe();

    loop {
        tokio::select! {
            // Receive message from the client (e.g., Ping or specific commands)
            msg = socket.next() => {
                if let Some(Ok(Message::Text(text))) = msg {
                    // We can handle ping/pong if needed
                    if text == "ping" {
                        let _ = socket.send(Message::Text("pong".into())).await;
                    }
                } else if msg.is_none() {
                    break;
                }
            }
            // Receive broadcast event from other parts of the application
            result = rx.recv() => {
                match result {
                    Ok(msg) => {
                        if socket.send(Message::Text(msg.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                        break;
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                        // Ignore skipped messages
                    }
                }
            }
        }
    }
}
