use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use sha2::{Digest, Sha256};
use tokio_tungstenite::{connect_async, tungstenite::client::IntoClientRequest};
use uuid::Uuid;

/// 获取计算好的 Sec-MS-GEC 值
fn get_sec_ms_gec() -> String {
    let now = Utc::now();
    let ticks = (now.timestamp_millis() as u128) * 10_000 + 116_444_736_000_000_000;
    // 向下取整到 5 分钟的倍数 (3,000,000,000 ticks)
    let rounded_ticks = ticks - (ticks % 3_000_000_000);
    let str_to_hash = format!("{}6A5AA1D4EAFF4E9FB37E23D68491D6F4", rounded_ticks);
    let mut hasher = Sha256::new();
    hasher.update(str_to_hash.as_bytes());
    let result = hasher.finalize();
    hex::encode(result).to_uppercase()
}

/// 测试指定音色，返回接收到的音频数据字节数
async fn test_voice(voice: &str) -> Result<usize, Box<dyn std::error::Error>> {
    let text = "这是一段测试语音。";
    let connection_id = Uuid::new_v4().as_simple().to_string();
    let sec_ms_gec = get_sec_ms_gec();
    
    let url = format!(
        "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId={}&Sec-MS-GEC={}&Sec-MS-GEC-Version=1-143.0.3650.75",
        connection_id, sec_ms_gec
    );

    let mut request = url.into_client_request()?;
    let headers = request.headers_mut();
    headers.insert("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold".parse()?);
    headers.insert("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0".parse()?);
    let muid = hex::encode(uuid::Uuid::new_v4().as_bytes()).to_uppercase();
    headers.insert("Cookie", format!("muid={};", muid).parse()?);

    let (mut ws_stream, _) = connect_async(request).await?;
    let date = Utc::now().format("%a %b %d %Y %H:%M:%S GMT+0000 (Coordinated Universal Time)").to_string();
    
    let config_msg = format!(
        "X-Timestamp:{}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":{{\"sentenceBoundaryEnabled\":false,\"wordBoundaryEnabled\":false}},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}}}}}",
        date
    );
    ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(config_msg.into())).await?;

    let ssml = format!(
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='{}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>{}</prosody></voice></speak>",
        voice, text
    );
    // 必须带有 X-RequestId，否则服务端会断开连接
    let ssml_msg = format!(
        "X-RequestId:{}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{}Z\r\nPath:ssml\r\n\r\n{}",
        connection_id, date, ssml
    );
    ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(ssml_msg.into())).await?;

    let mut audio_bytes = 0;
    while let Some(msg) = ws_stream.next().await {
        let msg = msg?;
        if msg.is_binary() {
            let data = msg.into_data();
            // Edge TTS 的音频二进制块，前 2 个字节是 header 长度
            let header_len = u16::from_be_bytes([data[0], data[1]]) as usize;
            if data.len() > header_len + 2 {
                audio_bytes += data.len() - (header_len + 2);
            }
        } else if msg.is_text() {
            let text = msg.into_text()?;
            if text.contains("Path:turn.end") {
                break;
            }
        } else {
            // 如果遇到其他消息，比如 Close 帧
            // 通常如果音色不支持，会在这里接收到 CloseFrame 包含 "Unsupported voice" 信息
            if let tokio_tungstenite::tungstenite::Message::Close(Some(close_frame)) = msg {
                return Err(format!("Server closed connection: {}", close_frame.reason).into());
            }
        }
    }
    
    if audio_bytes == 0 {
        return Err("Received 0 bytes of audio".into());
    }
    
    Ok(audio_bytes)
}

#[tokio::main]
async fn main() {
    println!("开始测试 Edge TTS 全部音色配置...\n");

    // 全量待测试音色列表
    let voices = vec![
        // 女声
        "zh-CN-XiaoxiaoNeural",
        "zh-CN-XiaoyiNeural",
        "zh-CN-XiaomoNeural",   // 已知下架
        "zh-CN-XiaochenNeural", // 已知下架
        "zh-CN-XiaohanNeural",  // 已知下架
        "zh-CN-XiaoruiNeural",  // 已知下架
        "zh-CN-XiaoyouNeural",  // 已知下架
        
        // 男声
        "zh-CN-YunxiNeural",
        "zh-CN-YunyangNeural",
        "zh-CN-YunjianNeural",
        "zh-CN-YunzeNeural",    // 已知下架
        "zh-CN-YunfengNeural",  // 已知下架
        "zh-CN-YunhaoNeural",   // 已知下架
        
        // 地方与方言
        "zh-CN-liaoning-XiaobeiNeural",
        "zh-CN-shaanxi-XiaoniNeural",
        "zh-HK-HiuMaanNeural",
        "zh-HK-WanLungNeural",
        "zh-TW-HsiaoChenNeural",
        "zh-TW-YunJheNeural",
    ];

    let mut success_count = 0;
    let mut fail_count = 0;

    for voice in &voices {
        print!("测试 {} ... ", voice);
        match test_voice(voice).await {
            Ok(size) => {
                println!("✅ 成功 ({} 字节)", size);
                success_count += 1;
            },
            Err(e) => {
                println!("❌ 失败 ({})", e);
                fail_count += 1;
            },
        }
    }

    println!("\n=== 测试完成 ===");
    println!("总计: {}", voices.len());
    println!("成功: {}", success_count);
    println!("失败: {}", fail_count);
    
    // 我们期望至少有 11 个成功的音色
    if success_count < 11 {
        std::process::exit(1);
    }
}
