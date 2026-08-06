use axum::{
    extract::Json,
    response::{IntoResponse, Response},
    http::{StatusCode, header},
};
use serde::Deserialize;
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use sha2::{Digest, Sha256};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::connect_async;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct TtsRequest {
    pub text: String,
    pub voice: String,
}

fn get_sec_ms_gec() -> String {
    let now = Utc::now();
    let ticks = (now.timestamp_millis() as u128) * 10_000 + 116_444_736_000_000_000;
    let rounded_ticks = ticks - (ticks % 3_000_000_000);
    let str_to_hash = format!("{}6A5AA1D4EAFF4E9FB37E23D68491D6F4", rounded_ticks);
    let mut hasher = Sha256::new();
    hasher.update(str_to_hash.as_bytes());
    let result = hasher.finalize();
    hex::encode(result).to_uppercase()
}

pub async fn handle_tts(Json(payload): Json<TtsRequest>) -> Result<Response, StatusCode> {
    match fetch_edge_tts_internal(payload.text, payload.voice).await {
        Ok(audio_data) => {
            let response = Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "audio/mpeg")
                .header(header::CACHE_CONTROL, "public, max-age=86400")
                .body(axum::body::Body::from(audio_data))
                .unwrap();
            Ok(response)
        }
        Err(e) => {
            println!("[TTS API] Error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn fetch_edge_tts_internal(
    text: String,
    voice: String,
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
        Ok(res) => res,
        Err(e) => return Err(format!("WS Connect Error: {}", e)),
    };

    let date = Utc::now().format("%a %b %d %Y %H:%M:%S GMT+0000 (Coordinated Universal Time)").to_string();
    
    let config_msg = format!(
        "X-Timestamp:{}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":{{\"sentenceBoundaryEnabled\":false,\"wordBoundaryEnabled\":false}},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}}}}}",
        date
    );

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
        return Err(e.to_string());
    }
    if let Err(e) = ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(ssml_msg.into())).await {
        return Err(e.to_string());
    }

    let mut audio_data = Vec::new();
    
    while let Some(msg_res) = ws_stream.next().await {
        match msg_res {
            Ok(msg) => {
                match msg {
                    tokio_tungstenite::tungstenite::Message::Binary(data) => {
                        if data.len() >= 2 {
                            let header_len = u16::from_be_bytes([data[0], data[1]]) as usize;
                            if data.len() > header_len + 2 {
                                let audio_chunk = &data[header_len + 2..];
                                audio_data.extend_from_slice(audio_chunk);
                            }
                        }
                    }
                    tokio_tungstenite::tungstenite::Message::Text(text_data) => {
                        if text_data.contains("Path:turn.end") {
                            break;
                        }
                    }
                    _ => {}
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    
    let _ = ws_stream.close(None).await;
    Ok(audio_data)
}
