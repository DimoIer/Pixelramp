mod files;
mod palettes;
mod recent;
mod storage;

use std::error::Error;
use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager, WebviewWindowBuilder};

fn webview_data_dir(app: &AppHandle) -> Result<PathBuf, Box<dyn Error>> {
  if let Ok(local) = app.path().app_local_data_dir() {
    if fs::create_dir_all(&local).is_ok() {
      let probe = local.join(".pixelramp-write-test");
      if fs::write(&probe, b"pixelramp").is_ok() {
        let _ = fs::remove_file(probe);
        return Ok(local);
      }
    }
  }

  // Portable/restricted environments may not permit writes to LocalAppData.
  // Keep the WebView2 profile beside the executable instead.
  let exe_dir = std::env::current_exe()?
    .parent()
    .ok_or("Could not resolve the executable directory.")?
    .to_path_buf();
  let fallback = exe_dir.join("PixelRampWebView");
  fs::create_dir_all(&fallback)?;
  Ok(fallback)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      files::read_file,
      files::write_file,
      files::reveal_path,
      palettes::list_palettes,
      palettes::save_palette,
      palettes::remove_palette,
      recent::add_recent,
      recent::list_recent,
      recent::clear_recent,
    ])
    .setup(|app| {
      if let Err(error) = storage::data_dir(app.handle()) {
        eprintln!("PixelRamp data directory error: {error}");
      }

      let window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .cloned()
        .ok_or("The main window configuration is missing.")?;
      let data_directory = webview_data_dir(app.handle())?;
      let window = WebviewWindowBuilder::from_config(app.handle(), &window_config)?
        .data_directory(data_directory)
        .build()?;
      let _ = window.show();
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running PixelRamp");
}
