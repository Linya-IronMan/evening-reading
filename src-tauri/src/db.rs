use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub tx: tokio::sync::broadcast::Sender<String>,
}

pub fn init_db(db_path: PathBuf) -> Result<AppState> {
    let conn = Connection::open(db_path)?;
    
    // Initialize schema
    conn.execute(
        "CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            file_name TEXT NOT NULL,
            total_blocks INTEGER NOT NULL,
            chapters TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS blocks (
            book_id TEXT NOT NULL,
            id TEXT NOT NULL,
            idx INTEGER NOT NULL,
            content TEXT NOT NULL,
            version INTEGER NOT NULL,
            PRIMARY KEY (book_id, id)
        )",
        [],
    )?;
    
    // Create an index for querying blocks ordered by idx
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_blocks_book_idx ON blocks(book_id, idx)",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS progress (
            book_id TEXT PRIMARY KEY,
            current_block_id TEXT NOT NULL,
            playback_speed REAL NOT NULL,
            voice_id TEXT,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL,
            block_id TEXT NOT NULL,
            start_offset INTEGER NOT NULL,
            end_offset INTEGER NOT NULL,
            quote_text TEXT NOT NULL,
            content TEXT NOT NULL,
            replies TEXT,
            is_orphaned BOOLEAN DEFAULT 0,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    // 数据库增量平滑迁移（若已存在的旧数据库缺少 replies 列则自动补全）
    let _ = conn.execute("ALTER TABLE comments ADD COLUMN replies TEXT", []);

    let (tx, _rx) = tokio::sync::broadcast::channel(100);

    Ok(AppState {
        db: Arc::new(Mutex::new(conn)),
        tx,
    })
}
