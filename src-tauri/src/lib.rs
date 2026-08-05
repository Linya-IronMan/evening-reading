mod tts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(tts::TtsState::default())
        .invoke_handler(tauri::generate_handler![
            tts::fetch_edge_tts,
            tts::cancel_edge_tts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
