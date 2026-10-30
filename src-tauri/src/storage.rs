use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
  if let Ok(value) = std::env::var("PIXELRAMP_USER_DATA") {
    let trimmed = value.trim();
    if !trimmed.is_empty() {
      return Ok(PathBuf::from(trimmed));
    }
  }
  app
    .path()
    .app_data_dir()
    .map_err(|error| format!("Could not resolve the application data directory: {error}"))
}

pub fn ensure_dir(dir: &Path) -> Result<(), String> {
  fs::create_dir_all(dir)
    .map_err(|error| format!("Could not create directory {}: {error}", dir.display()))
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
  let parent = path
    .parent()
    .ok_or_else(|| format!("Invalid target path: {}", path.display()))?;
  ensure_dir(parent)?;
  let file_name = path
    .file_name()
    .and_then(|name| name.to_str())
    .ok_or_else(|| format!("Invalid target file name: {}", path.display()))?;
  let temp_path = parent.join(format!(".{file_name}.{}.tmp", std::process::id()));

  fs::write(&temp_path, bytes)
    .map_err(|error| format!("Could not write temporary file: {error}"))?;

  if path.exists() {
    let _ = fs::remove_file(path);
  }

  if let Err(error) = fs::rename(&temp_path, path) {
    let _ = fs::remove_file(&temp_path);
    return Err(format!("Could not replace {}: {error}", path.display()));
  }
  Ok(())
}
