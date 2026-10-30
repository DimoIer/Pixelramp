use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

use crate::storage;

const MAX_READ_BYTES: u64 = 128 * 1024 * 1024;
const MAX_WRITE_BYTES: usize = 256 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedFileData {
  path: String,
  name: String,
  kind: String,
  bytes: Vec<u8>,
}

pub fn kind_for(path: &Path) -> &'static str {
  match path
    .extension()
    .and_then(|extension| extension.to_str())
    .map(|extension| extension.to_ascii_lowercase())
    .as_deref()
  {
    Some("pxramp") => "project",
    Some("png" | "jpg" | "jpeg" | "bmp" | "gif") => "image",
    Some("json") => "json",
    _ => "unknown",
  }
}

#[tauri::command]
pub fn read_file(path: String) -> Result<OpenedFileData, String> {
  let target = PathBuf::from(path);
  let metadata = fs::metadata(&target)
    .map_err(|error| format!("Could not inspect {}: {error}", target.display()))?;
  if !metadata.is_file() {
    return Err("The selected path is not a file.".to_string());
  }
  if metadata.len() > MAX_READ_BYTES {
    return Err("This file is too large to open (128 MB limit).".to_string());
  }

  let bytes =
    fs::read(&target).map_err(|error| format!("Could not read {}: {error}", target.display()))?;
  let name = target
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or("unnamed")
    .to_string();

  Ok(OpenedFileData {
    path: target.to_string_lossy().to_string(),
    name,
    kind: kind_for(&target).to_string(),
    bytes,
  })
}

#[tauri::command]
pub fn write_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
  if bytes.len() > MAX_WRITE_BYTES {
    return Err("The file is too large to save (256 MB limit).".to_string());
  }
  if path.trim().is_empty() {
    return Err("No save path was supplied.".to_string());
  }
  storage::atomic_write(&PathBuf::from(path), &bytes)
}

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
  let target = PathBuf::from(path);
  if target.as_os_str().is_empty() {
    return Err("No path was supplied.".to_string());
  }

  #[cfg(target_os = "windows")]
  {
    Command::new("explorer.exe")
      .arg("/select,")
      .arg(&target)
      .spawn()
      .map_err(|error| format!("Could not reveal the file: {error}"))?;
    return Ok(());
  }

  #[allow(unreachable_code)]
  {
    let parent = target.parent().unwrap_or(&target);
    #[cfg(target_os = "macos")]
    let command = "open";
    #[cfg(not(target_os = "macos"))]
    let command = "xdg-open";
    Command::new(command)
      .arg(parent)
      .spawn()
      .map_err(|error| format!("Could not reveal the file: {error}"))?;
    Ok(())
  }
}
