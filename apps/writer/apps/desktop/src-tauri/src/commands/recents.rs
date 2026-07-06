//! Global recently-opened-files list, shared by every window and workspace.
//!
//! Persisted in the app data dir (`recent_files.json`) as a JSON array of
//! `{ path, opened_at }` records (most-recent first). All read-modify-write
//! cycles hold `AppState::recent_files_lock` so two windows recording opens
//! concurrently can't drop each other's entries.

use crate::commands::fs::markdown_file_entry;
use crate::document::is_supported_document_path;
use crate::error::AppError;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const MAX_RECENT_FILES: usize = 30;

/// One persisted recents entry. `opened_at` is unix seconds; `0` marks a
/// legacy entry migrated from the old string-array format (unknown time).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecentEntry {
    pub path: String,
    #[serde(default)]
    pub opened_at: u64,
}

/// Display-ready recents entry returned to the frontend: file metadata plus
/// the last-opened timestamp.
#[derive(Debug, Clone, Serialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub title: Option<String>,
    pub opened_at: u64,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn recent_files_path(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("recent_files.json"))
}

fn load_recent_files(app: &tauri::AppHandle) -> Vec<RecentEntry> {
    let Ok(path) = recent_files_path(app) else {
        return Vec::new();
    };
    if !path.exists() {
        return Vec::new();
    }
    let Ok(data) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    // Current format: array of { path, opened_at }.
    if let Ok(entries) = serde_json::from_str::<Vec<RecentEntry>>(&data) {
        return entries;
    }
    // Legacy format: plain array of path strings (no timestamps).
    if let Ok(paths) = serde_json::from_str::<Vec<String>>(&data) {
        return paths
            .into_iter()
            .map(|path| RecentEntry { path, opened_at: 0 })
            .collect();
    }
    Vec::new()
}

fn save_recent_files(app: &tauri::AppHandle, recents: &[RecentEntry]) -> Result<(), AppError> {
    let path = recent_files_path(app)?;
    let data = serde_json::to_string_pretty(recents).map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::write(&path, data)?;
    Ok(())
}

/// Pure list update: dedupe by path, push to front with `opened_at`, cap.
/// Extracted (with an explicit clock) for deterministic unit testing.
fn push_recent(recents: &mut Vec<RecentEntry>, path: String, opened_at: u64) {
    recents.retain(|entry| entry.path != path);
    recents.insert(0, RecentEntry { path, opened_at });
    recents.truncate(MAX_RECENT_FILES);
}

fn is_markdown_file(path: &Path) -> bool {
    path.is_file() && is_supported_document_path(path)
}

/// Record a file open into the global recents list. Unsupported and
/// nonexistent paths are ignored rather than erroring — callers fire this
/// on every file activation and shouldn't have to pre-validate.
#[tauri::command]
pub fn record_recent_file(path: String, app: tauri::AppHandle) -> Result<(), AppError> {
    let file = PathBuf::from(&path);
    if !is_markdown_file(&file) {
        return Ok(());
    }
    let canonical = file
        .canonicalize()
        .unwrap_or(file)
        .to_string_lossy()
        .to_string();

    let state = app.state::<AppState>();
    let _guard = state.recent_files_lock.lock();
    let mut recents = load_recent_files(&app);
    push_recent(&mut recents, canonical, now_secs());
    save_recent_files(&app, &recents)
}

/// Drop a single path from the global recents list (the per-row delete in
/// the compact picker). No-op if the path isn't present.
#[tauri::command]
pub fn remove_recent_file(path: String, app: tauri::AppHandle) -> Result<(), AppError> {
    let state = app.state::<AppState>();
    let _guard = state.recent_files_lock.lock();
    let mut recents = load_recent_files(&app);
    let before = recents.len();
    recents.retain(|entry| entry.path != path);
    if recents.len() == before {
        return Ok(());
    }
    save_recent_files(&app, &recents)
}

/// Return the global recents as display-ready entries, most recent first.
/// Files that no longer exist are pruned from the persisted list so dead
/// entries don't accumulate.
#[tauri::command]
pub async fn get_recent_files_global(
    limit: Option<u32>,
    app: tauri::AppHandle,
) -> Result<Vec<RecentFile>, AppError> {
    let limit = limit.unwrap_or(MAX_RECENT_FILES as u32).max(1) as usize;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let _guard = state.recent_files_lock.lock();
        let recents = load_recent_files(&app);
        let alive: Vec<RecentEntry> = recents
            .iter()
            .filter(|entry| Path::new(&entry.path).is_file())
            .cloned()
            .collect();
        if alive.len() != recents.len() {
            let _ = save_recent_files(&app, &alive);
        }
        Ok(alive
            .iter()
            .take(limit)
            .filter_map(|entry| {
                markdown_file_entry(Path::new(&entry.path)).map(|file| RecentFile {
                    path: file.path,
                    name: file.name,
                    title: file.title,
                    opened_at: entry.opened_at,
                })
            })
            .collect())
    })
    .await
    .map_err(|e| AppError::Io(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(path: &str, opened_at: u64) -> RecentEntry {
        RecentEntry {
            path: path.to_string(),
            opened_at,
        }
    }

    #[test]
    fn push_recent_inserts_at_front_with_timestamp() {
        let mut recents = vec![entry("/a.md", 1), entry("/b.md", 2)];
        push_recent(&mut recents, "/c.md".to_string(), 99);
        assert_eq!(recents[0], entry("/c.md", 99));
        assert_eq!(
            recents.iter().map(|e| e.path.as_str()).collect::<Vec<_>>(),
            vec!["/c.md", "/a.md", "/b.md"]
        );
    }

    #[test]
    fn push_recent_dedupes_existing_path_and_refreshes_timestamp() {
        let mut recents = vec![entry("/a.md", 1), entry("/b.md", 2)];
        push_recent(&mut recents, "/b.md".to_string(), 99);
        assert_eq!(
            recents.iter().map(|e| e.path.as_str()).collect::<Vec<_>>(),
            vec!["/b.md", "/a.md"]
        );
        assert_eq!(recents[0].opened_at, 99);
    }

    #[test]
    fn push_recent_caps_at_max() {
        let mut recents: Vec<RecentEntry> = (0..MAX_RECENT_FILES)
            .map(|i| entry(&format!("/file-{i}.md"), i as u64))
            .collect();
        push_recent(&mut recents, "/newest.md".to_string(), 1000);
        assert_eq!(recents.len(), MAX_RECENT_FILES);
        assert_eq!(recents[0].path, "/newest.md");
        assert!(!recents
            .iter()
            .any(|e| e.path == format!("/file-{}.md", MAX_RECENT_FILES - 1)));
    }

    #[test]
    fn legacy_string_array_deserializes_with_zero_timestamp() {
        let legacy = r#"["/a.md", "/b.md"]"#;
        let parsed = serde_json::from_str::<Vec<RecentEntry>>(legacy);
        // New-format parse fails on bare strings; the loader's fallback maps
        // them to zero-timestamp entries.
        assert!(parsed.is_err());
        let paths: Vec<String> = serde_json::from_str(legacy).unwrap();
        let migrated: Vec<RecentEntry> = paths
            .into_iter()
            .map(|path| RecentEntry { path, opened_at: 0 })
            .collect();
        assert_eq!(migrated, vec![entry("/a.md", 0), entry("/b.md", 0)]);
    }

    #[test]
    fn is_markdown_file_rejects_non_markdown_and_missing() {
        let dir = tempfile::TempDir::new().unwrap();
        let md = dir.path().join("note.md");
        let mdx = dir.path().join("note.mdx");
        let txt = dir.path().join("note.txt");
        std::fs::write(&md, "# hi").unwrap();
        std::fs::write(&mdx, "# hi").unwrap();
        std::fs::write(&txt, "hi").unwrap();

        assert!(is_markdown_file(&md));
        assert!(is_markdown_file(&mdx));
        assert!(!is_markdown_file(&txt));
        assert!(!is_markdown_file(&dir.path().join("missing.md")));
        assert!(!is_markdown_file(dir.path()));
    }
}
