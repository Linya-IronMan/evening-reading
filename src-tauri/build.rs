fn main() {
    // 确保 dist 目录存在，避免开发环境下 rust-embed 宏找不到目录报错
    let dist_path = std::path::Path::new("../dist");
    if !dist_path.exists() {
        let _ = std::fs::create_dir_all(dist_path);
    }
    
    tauri_build::build()
}
