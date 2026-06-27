use crate::{
    errors::{to_io_error, AppResult},
    files::ensure_dir,
    models::MarkdownFile,
};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

pub fn list_recent_files(app: &AppHandle) -> AppResult<Vec<MarkdownFile>> {
    let path = recent_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let source = fs::read_to_string(path).map_err(to_io_error)?;
    serde_json::from_str(&source).map_err(|error| error.to_string())
}

pub fn add_recent_file(app: &AppHandle, path: &str) -> AppResult<()> {
    let recent_path = recent_path(app)?;
    if let Some(parent) = recent_path.parent() {
        ensure_dir(parent)?;
    }

    let mut items = list_recent_files(app)?;
    items.retain(|item| item.path != path);
    items.insert(
        0,
        MarkdownFile {
            path: path.to_string(),
            source: String::new(),
        },
    );
    items.truncate(20);

    let json = serde_json::to_string_pretty(&items).map_err(|error| error.to_string())?;
    fs::write(recent_path, json).map_err(to_io_error)?;
    Ok(())
}

fn recent_path(app: &AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("recent.json"))
        .map_err(|error| error.to_string())
}
