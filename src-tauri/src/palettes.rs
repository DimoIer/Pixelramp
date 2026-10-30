use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use crate::storage;

#[derive(Serialize, Deserialize, Default)]
struct IndexFile {
  version: u32,
  ids: Vec<String>,
}

fn palette_dir(app: &AppHandle) -> Result<PathBuf, String> {
  Ok(storage::data_dir(app)?.join("palettes"))
}

fn is_valid_id(id: &str) -> bool {
  if id.is_empty() || id.len() > 101 {
    return false;
  }
  let mut chars = id.chars();
  let Some(first) = chars.next() else {
    return false;
  };
  first.is_ascii_alphanumeric()
    && chars.all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '-')
}

fn is_rgba(value: &Value) -> bool {
  let Some(object) = value.as_object() else {
    return false;
  };
  ["r", "g", "b", "a"].iter().all(|channel| {
    object
      .get(*channel)
      .and_then(Value::as_u64)
      .map(|number| number <= 255)
      .unwrap_or(false)
  })
}

fn is_palette(value: &Value) -> bool {
  let Some(object) = value.as_object() else {
    return false;
  };
  let Some(id) = object.get("id").and_then(Value::as_str) else {
    return false;
  };
  if !is_valid_id(id) {
    return false;
  }
  if object.get("name").and_then(Value::as_str).is_none() {
    return false;
  }
  let Some(colors) = object.get("colors").and_then(Value::as_array) else {
    return false;
  };
  if colors.is_empty() || colors.len() > 100_000 {
    return false;
  }
  if !colors.iter().all(|color| {
    color
      .as_object()
      .and_then(|entry| entry.get("rgba"))
      .map(is_rgba)
      .unwrap_or(false)
  }) {
    return false;
  }
  let source = object.get("source").and_then(Value::as_str).unwrap_or("");
  if !matches!(source, "generated" | "extracted" | "manual") {
    return false;
  }
  object.get("createdAt").and_then(Value::as_u64).is_some()
    && object.get("updatedAt").and_then(Value::as_u64).is_some()
}

fn updated_at(value: &Value) -> u64 {
  value
    .get("updatedAt")
    .and_then(Value::as_u64)
    .unwrap_or_default()
}

fn read_index(dir: &Path) -> Vec<String> {
  let Ok(raw) = fs::read_to_string(dir.join("index.json")) else {
    return Vec::new();
  };
  let Ok(index) = serde_json::from_str::<IndexFile>(&raw) else {
    return Vec::new();
  };
  let mut ids = Vec::new();
  for id in index.ids {
    if is_valid_id(&id) && !ids.contains(&id) {
      ids.push(id);
    }
  }
  ids
}

fn write_index(dir: &Path, ids: &[String]) -> Result<(), String> {
  storage::ensure_dir(dir)?;
  let index = IndexFile {
    version: 1,
    ids: ids.to_vec(),
  };
  let json = serde_json::to_string_pretty(&index)
    .map_err(|error| format!("Could not serialize the palette index: {error}"))?;
  storage::atomic_write(&dir.join("index.json"), json.as_bytes())
}

fn read_palette(dir: &Path, id: &str) -> Option<Value> {
  if !is_valid_id(id) {
    return None;
  }
  let raw = fs::read_to_string(dir.join(format!("{id}.json"))).ok()?;
  let value = serde_json::from_str::<Value>(&raw).ok()?;
  if !is_palette(&value) {
    return None;
  }
  if value.get("id").and_then(Value::as_str) != Some(id) {
    return None;
  }
  Some(value)
}

fn list_from(app: &AppHandle) -> Result<Vec<Value>, String> {
  let dir = palette_dir(app)?;
  storage::ensure_dir(&dir)?;

  let indexed = read_index(&dir);
  let mut ids = indexed.clone();
  if let Ok(entries) = fs::read_dir(&dir) {
    for entry in entries.flatten() {
      let path = entry.path();
      if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
        continue;
      }
      if path.file_name().and_then(|name| name.to_str()) == Some("index.json") {
        continue;
      }
      if let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) {
        if is_valid_id(stem) && !ids.iter().any(|id| id == stem) {
          ids.push(stem.to_string());
        }
      }
    }
  }

  let mut palettes: Vec<Value> = ids
    .iter()
    .filter_map(|id| read_palette(&dir, id))
    .collect();
  palettes.sort_by(|a, b| updated_at(b).cmp(&updated_at(a)));

  let resolved: Vec<String> = palettes
    .iter()
    .filter_map(|palette| palette.get("id").and_then(Value::as_str))
    .map(ToString::to_string)
    .collect();
  if resolved != indexed {
    let _ = write_index(&dir, &resolved);
  }
  Ok(palettes)
}

#[tauri::command]
pub fn list_palettes(app: AppHandle) -> Result<Vec<Value>, String> {
  list_from(&app)
}

#[tauri::command]
pub fn save_palette(app: AppHandle, palette: Value) -> Result<Vec<Value>, String> {
  if !is_palette(&palette) {
    return Err("Refusing to save an invalid palette object.".to_string());
  }
  let id = palette
    .get("id")
    .and_then(Value::as_str)
    .ok_or_else(|| "Palette is missing an id.".to_string())?
    .to_string();
  let dir = palette_dir(&app)?;
  storage::ensure_dir(&dir)?;
  let json = serde_json::to_string_pretty(&palette)
    .map_err(|error| format!("Could not serialize the palette: {error}"))?;
  storage::atomic_write(&dir.join(format!("{id}.json")), json.as_bytes())?;

  let mut ids = read_index(&dir);
  ids.retain(|entry| entry != &id);
  ids.insert(0, id);
  write_index(&dir, &ids)?;
  list_from(&app)
}

#[tauri::command]
pub fn remove_palette(app: AppHandle, id: String) -> Result<Vec<Value>, String> {
  if !is_valid_id(&id) {
    return Err("Invalid palette id.".to_string());
  }
  let dir = palette_dir(&app)?;
  let file = dir.join(format!("{id}.json"));
  if let Err(error) = fs::remove_file(&file) {
    if error.kind() != std::io::ErrorKind::NotFound {
      return Err(format!("Could not remove the palette: {error}"));
    }
  }
  let mut ids = read_index(&dir);
  ids.retain(|entry| entry != &id);
  write_index(&dir, &ids)?;
  list_from(&app)
}
