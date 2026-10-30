use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::storage;

const MAX_RECENT: usize = 12;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
  path: String,
  name: String,
  kind: String,
  opened_at: u64,
}

#[derive(Serialize, Deserialize)]
struct RecentFileData {
  version: u32,
  entries: Vec<RecentFile>,
}

fn file_path(app: &AppHandle) -> Result<PathBuf, String> {
  Ok(storage::data_dir(app)?.join("recent.json"))
}

fn valid_kind(kind: &str) -> bool {
  matches!(kind, "image" | "project" | "json" | "unknown")
}

fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .unwrap_or(0)
}

fn read_entries(app: &AppHandle) -> Vec<RecentFile> {
  let Ok(path) = file_path(app) else {
    return Vec::new();
  };
  let Ok(raw) = fs::read_to_string(path) else {
    return Vec::new();
  };
  let Ok(data) = serde_json::from_str::<RecentFileData>(&raw) else {
    return Vec::new();
  };
  let mut entries: Vec<RecentFile> = data
    .entries
    .into_iter()
    .filter(|entry| {
      !entry.path.is_empty() && !entry.name.is_empty() && valid_kind(&entry.kind)
    })
    .collect();
  entries.sort_by(|a, b| b.opened_at.cmp(&a.opened_at));
  entries.truncate(MAX_RECENT);
  entries
}

fn write_entries(app: &AppHandle, entries: Vec<RecentFile>) -> Result<(), String> {
  let path = file_path(app)?;
  storage::ensure_dir(
    path
      .parent()
      .ok_or_else(|| "Could not resolve the recent-files directory.".to_string())?,
  )?;
  let data = RecentFileData { version: 1, entries };
  let json = serde_json::to_string_pretty(&data)
    .map_err(|error| format!("Could not serialize recent files: {error}"))?;
  storage::atomic_write(&path, json.as_bytes())
}

fn record(app: &AppHandle, file_path: String, kind: String) -> Result<(), String> {
  if kind != "image" && kind != "project" {
    return Ok(());
  }
  if file_path.trim().is_empty() {
    return Ok(());
  }
  let name = Path::new(&file_path)
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or(&file_path)
    .to_string();
  let entries = read_entries(app);
  let mut next = Vec::with_capacity(entries.len() + 1);
  next.push(RecentFile {
    path: file_path.clone(),
    name,
    kind,
    opened_at: now_ms(),
  });
  next.extend(
    entries
      .into_iter()
      .filter(|entry| !entry.path.eq_ignore_ascii_case(&file_path)),
  );
  next.truncate(MAX_RECENT);
  write_entries(app, next)
}

#[tauri::command]
pub fn add_recent(app: AppHandle, path: String, kind: String) -> Result<(), String> {
  record(&app, path, kind)
}

#[tauri::command]
pub fn list_recent(app: AppHandle) -> Result<Vec<RecentFile>, String> {
  Ok(
    read_entries(&app)
      .into_iter()
      .filter(|entry| Path::new(&entry.path).exists())
      .collect(),
  )
}

#[tauri::command]
pub fn clear_recent(app: AppHandle) -> Result<(), String> {
  let path = file_path(&app)?;
  if let Err(error) = fs::remove_file(&path) {
    if error.kind() != std::io::ErrorKind::NotFound {
      return Err(format!("Could not clear recent files: {error}"));
    }
  }
  Ok(())
}
