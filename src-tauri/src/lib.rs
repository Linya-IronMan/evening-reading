mod db;
mod api;

use tauri::Manager;

#[derive(serde::Serialize)]
struct SysInfo {
    version: String,
    local_ip: String,
    port: u16,
}

fn get_local_ip() -> String {
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = std::process::Command::new("ifconfig").output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut candidate_192 = None;
            let mut candidate_10 = None;
            let mut candidate_172 = None;

            for line in stdout.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("inet ") {
                    let parts: Vec<&str> = trimmed.split_whitespace().collect();
                    if parts.len() >= 2 {
                        let ip = parts[1];
                        if ip.starts_with("192.168.") {
                            candidate_192 = Some(ip.to_string());
                        } else if ip.starts_with("10.") {
                            candidate_10 = Some(ip.to_string());
                        } else if ip.starts_with("172.") && !ip.starts_with("198.18.") {
                            candidate_172 = Some(ip.to_string());
                        }
                    }
                }
            }

            if let Some(ip) = candidate_192 {
                return ip;
            }
            if let Some(ip) = candidate_10 {
                return ip;
            }
            if let Some(ip) = candidate_172 {
                return ip;
            }
        }
    }

    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("1.1.1.1:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                let ip = addr.ip().to_string();
                if !ip.starts_with("198.18.") {
                    return ip;
                }
            }
        }
    }

    "127.0.0.1".to_string()
}

/// 获取应用信息与网络配置（版本号、局域网 IP、服务端口）
#[tauri::command]
fn get_app_sys_info(app: tauri::AppHandle) -> SysInfo {
    let version = app.package_info().version.to_string();
    let local_ip = get_local_ip();
    SysInfo {
        version,
        local_ip,
        port: 1421,
    }
}

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
        .invoke_handler(tauri::generate_handler![restart_app, get_app_sys_info])
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
