mod db;
mod api;

use tauri::Manager;

/// 优雅重启应用命令
///
/// 供前端在热更新包下载解包完成后调用，干净退出当前进程并重新拉起最新版本。
#[tauri::command]
async fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    app.request_restart();
    Ok(())
}

/// 应用程序主入口运行函数
///
/// 初始化数据库、挂载本地 Axum 服务与各类 Tauri 核心插件（Opener, Updater）。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![restart_app])
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            tauri::async_runtime::spawn(async move {
                let data_dir = app_handle.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
                std::fs::create_dir_all(&data_dir).unwrap();
                let db_path = data_dir.join("reading_data.db");
                
                let state = db::init_db(db_path).expect("Failed to initialize database");
                
                let app = api::create_router(state);
                let listener = tokio::net::TcpListener::bind("0.0.0.0:1421").await.unwrap();
                println!("Server listening on {}", listener.local_addr().unwrap());
                axum::serve(listener, app).await.unwrap();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
