use crate::{errors::AppResult, file_tree};
use notify_debouncer_mini::{
    new_debouncer,
    notify::{RecommendedWatcher, RecursiveMode},
    DebounceEventResult, Debouncer,
};
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};
use tauri::{AppHandle, Emitter, State};

pub const FILE_TREE_CHANGED_EVENT: &str = "file-tree-changed";
const DEBOUNCE: Duration = Duration::from_millis(500);

struct WatchSession {
    _debouncer: Debouncer<RecommendedWatcher>,
    root: PathBuf,
}

#[derive(Default)]
pub struct FileWatcherState(Mutex<Option<WatchSession>>);

pub fn start_watching(app: &AppHandle, state: &FileWatcherState, root: &Path) -> AppResult<()> {
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", root.display()));
    }

    let mut guard = state.0.lock().map_err(|error| error.to_string())?;

    // Already watching this root — nothing to do.
    if guard.as_ref().is_some_and(|session| session.root == root) {
        return Ok(());
    }

    // Drop any previous watcher before starting a new one.
    *guard = None;

    let app_handle = app.clone();
    let mut debouncer = new_debouncer(DEBOUNCE, move |result: DebounceEventResult| {
        if let Ok(events) = result {
            let relevant = events
                .into_iter()
                .any(|event| is_relevant_change(&event.path));
            if relevant {
                let _ = app_handle.emit(FILE_TREE_CHANGED_EVENT, ());
            }
        }
    })
    .map_err(|error| error.to_string())?;

    debouncer
        .watcher()
        .watch(root, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;

    *guard = Some(WatchSession {
        _debouncer: debouncer,
        root: root.to_path_buf(),
    });

    Ok(())
}

pub fn stop_watching(state: &FileWatcherState) -> AppResult<()> {
    let mut guard = state.0.lock().map_err(|error| error.to_string())?;
    *guard = None;
    Ok(())
}

/// A change is relevant when it touches a markdown file or a directory, and is
/// not inside the app-managed `.madinah-writer` folder (e.g. the trash bin),
/// which would otherwise trigger refresh loops on our own writes.
fn is_relevant_change(path: &Path) -> bool {
    if path
        .components()
        .any(|component| component.as_os_str() == ".madinah-writer")
    {
        return false;
    }

    // Directory create/remove has no extension; markdown files match by suffix.
    // A removed file no longer exists on disk, so fall back to the suffix check.
    path.extension().is_none() || file_tree::is_markdown_path(path)
}

#[tauri::command]
pub fn watch_file_tree(
    app: AppHandle,
    state: State<'_, FileWatcherState>,
    root: String,
) -> AppResult<()> {
    start_watching(&app, &state, Path::new(&root))
}

#[tauri::command]
pub fn unwatch_file_tree(state: State<'_, FileWatcherState>) -> AppResult<()> {
    stop_watching(&state)
}
