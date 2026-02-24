use std::sync::Mutex;
use std::thread;
use tiny_http::{Response, Server};
use screenshots::Screen;
use image::ImageFormat;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use tauri::Manager;

// Global storage for OAuth tokens
static OAUTH_TOKENS: Mutex<Option<String>> = Mutex::new(None);

#[derive(serde::Serialize)]
pub struct CaptureResult {
    pub text: String,
    pub image_base64: String,
    pub image_path: Option<String>,
}

/// Capture the primary screen and run OCR on it
#[tauri::command]
async fn capture_score(app_handle: tauri::AppHandle) -> Result<CaptureResult, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    let screen = screens.first().ok_or("No screens found")?;
    let image = screen.capture().map_err(|e| format!("Failed to capture screen: {}", e))?;

    let mut png_bytes: Vec<u8> = Vec::new();
    let rgba_image = image::RgbaImage::from_raw(
        image.width(), image.height(), image.as_raw().clone(),
    ).ok_or("Failed to create image from capture")?;
    let dynamic_image = image::DynamicImage::ImageRgba8(rgba_image);
    dynamic_image.write_to(&mut std::io::Cursor::new(&mut png_bytes), ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let captures_dir = app_data_dir.join("captures");
    std::fs::create_dir_all(&captures_dir)
        .map_err(|e| format!("Failed to create captures dir: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    let image_path = captures_dir.join(format!("scorecard_{}.png", timestamp));
    std::fs::write(&image_path, &png_bytes)
        .map_err(|e| format!("Failed to save image: {}", e))?;

    let image_base64 = BASE64.encode(&png_bytes);
    let ocr_text = run_ocr(&png_bytes).await?;

    Ok(CaptureResult { text: ocr_text, image_base64, image_path: Some(image_path.to_string_lossy().to_string()) })
}

/// Capture the GameDay window specifically
#[tauri::command]
async fn capture_gameday(app_handle: tauri::AppHandle) -> Result<CaptureResult, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            FindWindowW, SetForegroundWindow, GetWindowRect, ShowWindow, SW_RESTORE,
        };
        use windows::Win32::Foundation::RECT;
        use windows::core::PCWSTR;

        let window_titles = ["Gameday_G", "Uneekor GameDay", "GameDay", "Uneekor"];
        let mut hwnd = None;
        for title in &window_titles {
            let wide_title: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
            let found = unsafe { FindWindowW(PCWSTR::null(), PCWSTR(wide_title.as_ptr())) };
            if let Ok(h) = found {
                if h.0 != std::ptr::null_mut() {
                    hwnd = Some(h);
                    break;
                }
            }
        }
        let hwnd = hwnd.ok_or("GameDay window not found. Make sure GameDay is running.")?;

        unsafe {
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = SetForegroundWindow(hwnd);
        }
        std::thread::sleep(std::time::Duration::from_millis(200));

        let mut rect = RECT::default();
        unsafe {
            GetWindowRect(hwnd, &mut rect)
                .map_err(|e| format!("Failed to get window rect: {}", e))?;
        }

        let x = rect.left;
        let y = rect.top;
        let width = (rect.right - rect.left) as u32;
        let height = (rect.bottom - rect.top) as u32;
        if width == 0 || height == 0 {
            return Err("GameDay window has invalid dimensions".to_string());
        }

        let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
        let screen = screens.first().ok_or("No screens found")?;
        let image = screen.capture_area(x, y, width, height)
            .map_err(|e| format!("Failed to capture GameDay window: {}", e))?;

        let mut png_bytes: Vec<u8> = Vec::new();
        let rgba_image = image::RgbaImage::from_raw(
            image.width(), image.height(), image.as_raw().clone(),
        ).ok_or("Failed to create image")?;
        let dynamic_image = image::DynamicImage::ImageRgba8(rgba_image);
        dynamic_image.write_to(&mut std::io::Cursor::new(&mut png_bytes), ImageFormat::Png)
            .map_err(|e| format!("Failed to encode PNG: {}", e))?;

        let app_data_dir = app_handle.path().app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;
        let captures_dir = app_data_dir.join("captures");
        std::fs::create_dir_all(&captures_dir)
            .map_err(|e| format!("Failed to create captures dir: {}", e))?;

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
        let image_path = captures_dir.join(format!("gameday_{}.png", timestamp));
        std::fs::write(&image_path, &png_bytes)
            .map_err(|e| format!("Failed to save image: {}", e))?;

        let image_base64 = BASE64.encode(&png_bytes);
        let ocr_text = run_ocr(&png_bytes).await?;

        Ok(CaptureResult { text: ocr_text, image_base64, image_path: Some(image_path.to_string_lossy().to_string()) })
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_handle;
        Err("GameDay capture is only supported on Windows".to_string())
    }
}

#[cfg(target_os = "windows")]
async fn run_ocr(image_bytes: &[u8]) -> Result<String, String> {
    use windows::{
        Graphics::Imaging::BitmapDecoder,
        Media::Ocr::OcrEngine,
        Storage::Streams::{DataWriter, InMemoryRandomAccessStream},
    };

    let stream = InMemoryRandomAccessStream::new()
        .map_err(|e| format!("Failed to create stream: {}", e))?;
    let writer = DataWriter::CreateDataWriter(&stream)
        .map_err(|e| format!("Failed to create data writer: {}", e))?;
    writer.WriteBytes(image_bytes)
        .map_err(|e| format!("Failed to write bytes: {}", e))?;
    writer.StoreAsync().map_err(|e| format!("Failed to store: {}", e))?.get()
        .map_err(|e| format!("Failed to get store result: {}", e))?;
    writer.FlushAsync().map_err(|e| format!("Failed to flush: {}", e))?.get()
        .map_err(|e| format!("Failed to get flush result: {}", e))?;
    stream.Seek(0).map_err(|e| format!("Failed to seek: {}", e))?;

    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| format!("Failed to create decoder: {}", e))?.get()
        .map_err(|e| format!("Failed to get decoder: {}", e))?;
    let bitmap = decoder.GetSoftwareBitmapAsync()
        .map_err(|e| format!("Failed to get bitmap async: {}", e))?.get()
        .map_err(|e| format!("Failed to get bitmap: {}", e))?;

    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|e| format!("Failed to create OCR engine: {}", e))?;
    let result = engine.RecognizeAsync(&bitmap)
        .map_err(|e| format!("Failed to start OCR: {}", e))?.get()
        .map_err(|e| format!("Failed to get OCR result: {}", e))?;
    let text = result.Text()
        .map_err(|e| format!("Failed to get text: {}", e))?;

    Ok(text.to_string())
}

#[cfg(not(target_os = "windows"))]
async fn run_ocr(_image_bytes: &[u8]) -> Result<String, String> {
    Err("OCR is only supported on Windows".to_string())
}

#[tauri::command]
fn get_oauth_tokens() -> Option<String> {
    let mut guard = OAUTH_TOKENS.lock().unwrap();
    guard.take()
}

#[tauri::command]
fn start_oauth_server() -> Result<u16, String> {
    {
        let mut guard = OAUTH_TOKENS.lock().unwrap();
        *guard = None;
    }

    let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(0);
    if port == 0 {
        return Err("Failed to get server port".to_string());
    }

    thread::spawn(move || {
        if let Ok(request) = server.recv() {
            let request_url = request.url().to_string();

            // PKCE flow: code arrives as a query parameter on the callback URL
            if let Some(query_start) = request_url.find('?') {
                let query = &request_url[query_start + 1..];
                if query.contains("code=") {
                    let mut guard = OAUTH_TOKENS.lock().unwrap();
                    *guard = Some(query.to_string());
                }
            }

            let html = r#"
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Complete</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex; justify-content: center; align-items: center;
            height: 100vh; margin: 0;
            background: #0A0A0A; color: white;
        }
        .container { text-align: center; padding: 2rem; }
        h1 { color: #F5C300; font-size: 2rem; }
        p { color: #888; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⛳ Authentication Successful</h1>
        <p>You can close this tab and return to The Clubhouse.</p>
    </div>
    <script>
        const hash = window.location.hash.substring(1);
        const status = document.querySelector('p');
        if (hash) {
            fetch('/tokens?' + hash, { method: 'POST' })
                .then(() => { status.textContent = 'Done! You can close this tab.'; })
                .catch(err => { status.textContent = 'Error: ' + err.message; });
        } else {
            status.textContent = 'Done! You can close this tab.';
        }
    </script>
</body>
</html>"#;

            let response = Response::from_string(html)
                .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html"[..]).unwrap());
            let _ = request.respond(response);

            // Implicit flow fallback: tokens arrive via JS hash post
            if let Ok(token_request) = server.recv_timeout(std::time::Duration::from_secs(5)) {
                if let Some(req) = token_request {
                    let token_url = req.url().to_string();
                    if token_url.starts_with("/tokens?") {
                        let query = &token_url[8..];
                        let mut guard = OAUTH_TOKENS.lock().unwrap();
                        if guard.is_none() {
                            *guard = Some(query.to_string());
                        }
                    }
                    let _ = req.respond(Response::from_string("ok"));
                }
            }
        }
    });

    Ok(port)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            start_oauth_server,
            get_oauth_tokens,
            capture_score,
            capture_gameday,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
