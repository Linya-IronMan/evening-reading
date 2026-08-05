use chrono::Utc;
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use hex;
use sha2::{Digest, Sha256};
use tauri::State;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::connect_async;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub struct TtsState {
    pub active_requests: DashMap<String, CancellationToken>,
}

impl Default for TtsState {
    fn default() -> Self {
        Self {
            active_requests: DashMap::new(),
        }
    }
}

fn get_sec_ms_gec() -> String {
    let now = Utc::now();
    let ticks = (now.timestamp_millis() as u128) * 10_000 + 116_444_736_000_000_000;
    // Round down to the nearest 5 minutes (300 seconds = 3,000,000,000 ticks)
    let rounded_ticks = ticks - (ticks % 3_000_000_000);
    let str_to_hash = format!("{}6A5AA1D4EAFF4E9FB37E23D68491D6F4", rounded_ticks);
    let mut hasher = Sha256::new();
    hasher.update(str_to_hash.as_bytes());
    let result = hasher.finalize();
    hex::encode(result).to_uppercase()
}

#[tauri::command]
pub async fn cancel_edge_tts(request_id: String, state: State<'_, TtsState>) -> Result<(), String> {
    if let Some((_, token)) = state.active_requests.remove(&request_id) {
        token.cancel();
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_edge_tts(
    request_id: String,
    text: String,
    voice: String,
    state: State<'_, TtsState>,
) -> Result<Vec<u8>, String> {
    println!("[TTS] Received request to fetch TTS. requestId={}, voice={}", request_id, voice);
    let token = CancellationToken::new();
    state.active_requests.insert(request_id.clone(), token.clone());

    let result = fetch_edge_tts_internal(text, voice, token.clone()).await;
    
    match &result {
        Ok(data) => println!("[TTS] fetch_edge_tts_internal SUCCESS, audio bytes: {}", data.len()),
        Err(e) => println!("[TTS] fetch_edge_tts_internal FAILED: {}", e),
    }

    state.active_requests.remove(&request_id);
    result
}

async fn fetch_edge_tts_internal(
    text: String,
    voice: String,
    token: CancellationToken,
) -> Result<Vec<u8>, String> {
    let connection_id = Uuid::new_v4().as_simple().to_string();
    let sec_ms_gec = get_sec_ms_gec();
    
    let chromium_full_version = "143.0.3650.75";
    let chromium_major_version = "143";
    let sec_ms_gec_version = format!("1-{}", chromium_full_version);
    let user_agent = format!("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{}.0.0.0 Safari/537.36 Edg/{}.0.0.0", chromium_major_version, chromium_major_version);
    
    let url_str = format!(
        "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId={}&Sec-MS-GEC={}&Sec-MS-GEC-Version={}",
        connection_id, sec_ms_gec, sec_ms_gec_version
    );
    
    let mut request = match url_str.into_client_request() {
        Ok(r) => r,
        Err(e) => return Err(e.to_string()),
    };
    
    let headers = request.headers_mut();
    headers.insert("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold".parse().unwrap());
    headers.insert("User-Agent", user_agent.parse().unwrap());
    headers.insert("Pragma", "no-cache".parse().unwrap());
    headers.insert("Cache-Control", "no-cache".parse().unwrap());
    headers.insert("Accept-Encoding", "gzip, deflate, br, zstd".parse().unwrap());
    headers.insert("Accept-Language", "en-US,en;q=0.9".parse().unwrap());
    
    let muid = hex::encode(Uuid::new_v4().as_bytes()).to_uppercase();
    let cookie_val = format!("muid={};", muid);
    headers.insert("Cookie", cookie_val.parse().unwrap());

    println!("[TTS] Connecting to WS...");
    let (mut ws_stream, _resp) = match connect_async(request).await {
        Ok(res) => {
            println!("[TTS] Connected! HTTP Status: {}", res.1.status());
            res
        },
        Err(e) => {
            println!("[TTS] WS Connect Error: {}", e);
            return Err(format!("WS Connect Error: {}", e));
        }
    };

    let date = Utc::now().format("%a %b %d %Y %H:%M:%S GMT+0000 (Coordinated Universal Time)").to_string();
    
    let config_msg = format!(
        "X-Timestamp:{}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":{{\"sentenceBoundaryEnabled\":false,\"wordBoundaryEnabled\":false}},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}}}}}",
        date
    );

    // Some simple escaping for SSML to avoid XML breakage on & < >
    let escaped_text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");

    let ssml = format!(
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='{}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>{}</prosody></voice></speak>",
        voice, escaped_text
    );
    let ssml_msg = format!(
        "X-RequestId:{}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{}Z\r\nPath:ssml\r\n\r\n{}",
        connection_id, date, ssml
    );

    if let Err(e) = ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(config_msg.into())).await {
        println!("[TTS] Failed to send config_msg: {}", e);
        return Err(e.to_string());
    }
    if let Err(e) = ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(ssml_msg.into())).await {
        println!("[TTS] Failed to send ssml_msg: {}", e);
        return Err(e.to_string());
    }

    println!("[TTS] Payloads sent successfully, waiting for audio data...");

    let mut audio_data = Vec::new();
    
    loop {
        tokio::select! {
            _ = token.cancelled() => {
                println!("[TTS] Token cancelled during loop!");
                let _ = ws_stream.close(None).await;
                return Err("AbortError".to_string());
            }
            msg_res = ws_stream.next() => {
                match msg_res {
                    Some(Ok(msg)) => {
                        match msg {
                            tokio_tungstenite::tungstenite::Message::Binary(data) => {
                                let path_marker = b"Path:audio\r\n";
                                if let Some(pos) = data.windows(path_marker.len()).position(|w| w == path_marker) {
                                    let header_len = pos + path_marker.len();
                                    if data.len() > header_len {
                                        audio_data.extend_from_slice(&data[header_len..]);
                                    }
                                }
                            }
                            tokio_tungstenite::tungstenite::Message::Text(text_data) => {
                                if text_data.contains("Path:turn.end") {
                                    println!("[TTS] Received Path:turn.end, finished reading.");
                                    break;
                                }
                            }
                            _ => {}
                        }
                    }
                    Some(Err(e)) => {
                        println!("[TTS] ws_stream.next() returned Err: {}", e);
                        return Err(e.to_string());
                    },
                    None => {
                        println!("[TTS] ws_stream closed unexpectedly");
                        break;
                    },
                }
            }
        }
    }
    
    let _ = ws_stream.close(None).await;
    Ok(audio_data)
}
