use crate::assistant::{AgentCoordinator, WriterMutationPermit, WriterMutationPreparation};
use crate::config::Settings;
use crate::ignore::WorkspaceIgnore;
use crate::open_target::PendingOpenPayload;
use cap_std::ambient_authority;
use cap_std::fs::Dir;
use notify::RecommendedWatcher;
use parking_lot::{Mutex, RwLock};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Per-window workspace state. Every open window has exactly one
/// `WorkspaceState`, keyed by the window's Tauri label inside [`AppState`].
/// All workspace-bound runtime data — the loaded file index, the file
/// watcher, the gitignore matcher, the per-window settings layer — lives
/// here so multiple windows can host different workspaces simultaneously
/// without clobbering each other.
pub struct WorkspaceState {
    pub workspace_root: RwLock<Option<PathBuf>>,
    pub file_index: RwLock<Vec<IndexedFile>>,
    pub recent_files_cache: RwLock<Option<Vec<IndexedFile>>>,
    pub dirs_with_markdown: RwLock<HashSet<PathBuf>>,
    /// Set to `true` after the first full index completes.
    /// When `false`, `dir_contains_markdown` falls back to recursive check.
    pub index_ready: AtomicBool,
    pub watcher_handle: RwLock<Option<RecommendedWatcher>>,
    /// Tracks recently written paths to avoid echo from file watcher.
    /// Maps path -> time of write. Entries older than 2s are stale.
    pub recent_writes: RwLock<HashMap<PathBuf, Instant>>,
    /// Gitignore matcher for the current workspace. Rebuilt when any
    /// `.gitignore` file changes. `None` until the first workspace is opened.
    pub workspace_ignore: RwLock<Option<Arc<WorkspaceIgnore>>>,
    /// Monotonic counter incremented on every workspace switch inside this
    /// window. Background tasks capture it at launch and re-check before
    /// writing; stale results are dropped. Watcher closures capture it too
    /// so events queued against a prior workspace never mutate the new
    /// workspace's state.
    pub workspace_epoch: AtomicU64,
    /// Cancellation flag threaded through the active index walker. On
    /// workspace switch the outgoing flag is flipped to `true` so the old
    /// walker exits within a directory boundary instead of running to
    /// completion; a fresh flag is installed for the new workspace.
    pub cancel_index: RwLock<Arc<AtomicBool>>,
    /// Per-window settings: global layer is loaded from the app data dir
    /// (shared by all windows) but the workspace layer reflects *this*
    /// window's workspace. Two windows with different workspaces therefore
    /// carry different merged settings without clobbering each other.
    pub settings: RwLock<Option<Settings>>,
    /// Open target set before this window's `get_startup_state` has read the
    /// startup slot. Usually seeded during window creation (CLI args or
    /// `open_new_workspace_window`); macOS `RunEvent::Opened` can also seed
    /// the hidden main window before React asks for startup state.
    pub startup_open: Mutex<Option<PendingOpenPayload>>,
    /// Flips to `true` once `get_startup_state` has attempted to read
    /// `startup_open`. After this point, open events must use `pending_open`
    /// because the startup slot will not be read again.
    pub startup_open_taken: AtomicBool,
    /// Runtime-only queue for drag-drop / dock-drop events after the startup
    /// slot has been read. Drained by the frontend once startup hydration
    /// completes. Never read by `get_startup_state`.
    pub pending_open: Mutex<VecDeque<PendingOpenPayload>>,
    /// The single file hosted by this window when it runs in standalone
    /// compact mode (no workspace root). Used to dedupe repeat opens of the
    /// same file onto the existing window and as the target of the
    /// single-file watcher.
    pub standalone_file: RwLock<Option<PathBuf>>,
    /// Monotonic discovery request generation for this window. A newer
    /// refresh or Workspace transition invalidates older compatibility work.
    pub assistant_discovery_epoch: Arc<AtomicU64>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct IndexedFile {
    pub path: PathBuf,
    pub relative_path: String,
    pub name: String,
    pub modified_at: u64,
}

impl Default for WorkspaceState {
    fn default() -> Self {
        Self {
            workspace_root: RwLock::new(None),
            file_index: RwLock::new(Vec::new()),
            recent_files_cache: RwLock::new(None),
            dirs_with_markdown: RwLock::new(HashSet::new()),
            index_ready: AtomicBool::new(false),
            watcher_handle: RwLock::new(None),
            recent_writes: RwLock::new(HashMap::new()),
            workspace_ignore: RwLock::new(None),
            workspace_epoch: AtomicU64::new(0),
            cancel_index: RwLock::new(Arc::new(AtomicBool::new(false))),
            settings: RwLock::new(None),
            startup_open: Mutex::new(None),
            startup_open_taken: AtomicBool::new(false),
            pending_open: Mutex::new(VecDeque::new()),
            standalone_file: RwLock::new(None),
            assistant_discovery_epoch: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl WorkspaceState {
    /// Cancel compatibility probes captured against the previous Workspace
    /// identity. Call only after publishing the new root/file identity so a
    /// discovery command cannot validate the outgoing root after this bump.
    pub fn invalidate_assistant_discovery(&self) {
        self.assistant_discovery_epoch
            .fetch_add(1, Ordering::AcqRel);
    }

    pub fn set_startup_open(&self, payload: PendingOpenPayload) {
        debug_assert!(
            !self.startup_open_taken.load(Ordering::Acquire),
            "startup_open was set after get_startup_state consumed it"
        );
        *self.startup_open.lock() = Some(payload);
    }

    pub fn try_set_startup_open(
        &self,
        payload: PendingOpenPayload,
    ) -> Result<(), PendingOpenPayload> {
        let mut startup_open = self.startup_open.lock();
        if self.startup_open_taken.load(Ordering::Acquire) || startup_open.is_some() {
            return Err(payload);
        }
        *startup_open = Some(payload);
        Ok(())
    }

    pub fn take_startup_open(&self) -> Option<PendingOpenPayload> {
        let mut startup_open = self.startup_open.lock();
        let payload = startup_open.take();
        self.startup_open_taken.store(true, Ordering::Release);
        payload
    }

    pub fn push_pending_open(&self, payload: PendingOpenPayload) {
        let mut pending = self.pending_open.lock();
        if pending.back() == Some(&payload) {
            return;
        }
        pending.push_back(payload);
    }

    pub fn pop_pending_open(&self) -> Option<PendingOpenPayload> {
        self.pending_open.lock().pop_front()
    }

    pub fn invalidate_recent_files_cache(&self) {
        *self.recent_files_cache.write() = None;
    }

    pub fn recent_files_slice(&self, offset: usize, limit: usize) -> Vec<IndexedFile> {
        if self.recent_files_cache.read().is_none() {
            let mut files = self.file_index.read().clone();
            files.sort_by(|a, b| {
                b.modified_at
                    .cmp(&a.modified_at)
                    .then_with(|| a.relative_path.cmp(&b.relative_path))
            });
            *self.recent_files_cache.write() = Some(files);
        }

        self.recent_files_cache
            .read()
            .as_ref()
            .map(|files| files.iter().skip(offset).take(limit).cloned().collect())
            .unwrap_or_default()
    }

    pub fn update_index_modified_at(&self, path: &Path, modified_at: u64) {
        let mut changed = false;
        {
            let mut index = self.file_index.write();
            if let Some(file) = index.iter_mut().find(|file| file.path == path) {
                if file.modified_at != modified_at {
                    file.modified_at = modified_at;
                    changed = true;
                }
            }
        }

        if changed {
            self.invalidate_recent_files_cache();
        }
    }

    pub fn has_pending_workspace(&self, path: &Path) -> bool {
        let matches = |payload: &PendingOpenPayload| {
            payload
                .workspace
                .as_deref()
                .is_some_and(|workspace| Path::new(workspace) == path)
        };
        if self.startup_open.lock().as_ref().is_some_and(matches) {
            return true;
        }
        self.pending_open.lock().iter().any(matches)
    }

    pub fn has_pending_file(&self, path: &Path) -> bool {
        let matches = |payload: &PendingOpenPayload| {
            payload.workspace.is_none()
                && payload
                    .file
                    .as_deref()
                    .is_some_and(|file| Path::new(file) == path)
        };
        if self.startup_open.lock().as_ref().is_some_and(matches) {
            return true;
        }
        self.pending_open.lock().iter().any(matches)
    }
}

/// Process-wide registry of per-window `WorkspaceState`, keyed by Tauri
/// window label. The main window uses the label `"main"`; secondary
/// windows get uuid-based labels assigned by
/// `commands::workspace::open_workspace_in_new_window`.
pub struct AppState {
    windows: RwLock<HashMap<String, Arc<WorkspaceState>>>,
    /// Serializes read-modify-write on the shared `sessions.json` file so
    /// two windows can't clobber each other's tab state under the 500 ms
    /// debounce. Held only for the load→save span.
    pub sessions_file_lock: Mutex<()>,
    /// Serializes read-modify-write on the shared `recent_files.json` file
    /// so concurrent recents updates from multiple windows don't drop each
    /// other's entries. Held only for the load→save span.
    pub recent_files_lock: Mutex<()>,
    /// Serializes versioned read-modify-write updates to the process-wide
    /// custom ACP Agent registration document.
    pub assistant_registrations_lock: Mutex<()>,
    /// Serializes versioned per-canonical-Workspace AI Access Consent writes.
    pub assistant_consents_lock: Mutex<()>,
    /// Serializes versioned Assistant Conversation index and per-conversation records.
    pub assistant_conversations_lock: Mutex<()>,
    /// Sole process-wide owner of active Agent Turns, keyed by canonical Workspace.
    pub agent_coordinator: Arc<AgentCoordinator>,
}

pub struct WriterMutationContext {
    pub(crate) _permit: Option<WriterMutationPermit>,
    pub root: PathBuf,
    pub dir: Dir,
    pub targets: Vec<PathBuf>,
}

impl AppState {
    pub fn begin_writer_mutation_context(
        &self,
        window_label: &str,
        targets: &[&Path],
        preparation: Option<&WriterMutationPreparation>,
    ) -> Result<WriterMutationContext, crate::error::AppError> {
        let window = self
            .get(window_label)
            .ok_or_else(|| crate::error::AppError::Io("Unknown Writer window".into()))?;
        let root = window.workspace_root.read().clone().or_else(|| {
            targets
                .iter()
                .find_map(|target| self.workspace_root_for_target(target))
        });
        let (root, dir) = if let Some(root) = root {
            let root = root
                .canonicalize()
                .map_err(|e| crate::error::AppError::Io(e.to_string()))?;
            let dir = Dir::open_ambient_dir(&root, ambient_authority())
                .map_err(|e| crate::error::AppError::Io(e.to_string()))?;
            (root, dir)
        } else {
            let target = targets
                .first()
                .ok_or_else(|| crate::error::AppError::Io("No mutation target".into()))?;
            let parent = target
                .parent()
                .ok_or_else(|| crate::error::AppError::Io("No mutation parent".into()))?
                .canonicalize()
                .map_err(|e| crate::error::AppError::Io(e.to_string()))?;
            let dir = Dir::open_ambient_dir(&parent, ambient_authority())
                .map_err(|e| crate::error::AppError::Io(e.to_string()))?;
            (parent, dir)
        };
        let mut relatives = Vec::with_capacity(targets.len());
        for target in targets {
            let canonical = self.secure_mutation_path(target)?;
            let relative = canonical
                .strip_prefix(&root)
                .map_err(|_| crate::error::AppError::Io("Mutation escaped capability root".into()))?
                .to_path_buf();
            if relative.components().any(|c| {
                matches!(
                    c,
                    std::path::Component::RootDir | std::path::Component::ParentDir
                )
            }) {
                return Err(crate::error::AppError::Io(
                    "Invalid capability-relative target".into(),
                ));
            }
            relatives.push(relative);
        }
        let permit = if window.workspace_root.read().is_some()
            || self.workspace_root_for_target(targets[0]).is_some()
        {
            self.agent_coordinator
                .acquire_writer_mutation(window_label, &root, preparation)
                .map_err(crate::error::AppError::Io)?
                .attach_capability(
                    dir.try_clone()
                        .map_err(|e| crate::error::AppError::Io(e.to_string()))?,
                )
        } else {
            return Ok(WriterMutationContext {
                _permit: None,
                root,
                dir,
                targets: relatives,
            });
        };
        Ok(WriterMutationContext {
            _permit: Some(permit),
            root,
            dir,
            targets: relatives,
        })
    }

    pub fn begin_writer_mutation(
        &self,
        window_label: &str,
        targets: &[&Path],
        preparation: Option<&WriterMutationPreparation>,
    ) -> Result<Option<WriterMutationPermit>, crate::error::AppError> {
        let Some(window_state) = self.get(window_label) else {
            return Ok(None);
        };
        let root = window_state.workspace_root.read().clone().or_else(|| {
            targets
                .iter()
                .find_map(|target| self.workspace_root_for_target(target))
        });
        let Some(root) = root else {
            if preparation.is_some() {
                return Err(crate::error::AppError::Io(
                    "The Agent Turn preparation write has no active Workspace.".into(),
                ));
            }
            return Ok(None);
        };
        if targets.is_empty()
            || targets
                .iter()
                .any(|target| Self::canonical_target_within_root(target, &root).is_err())
        {
            return Err(crate::error::AppError::Io(
                "Writer rejected a Workspace mutation whose target is outside the invoking window's current Workspace."
                    .into(),
            ));
        }
        self.agent_coordinator
            .acquire_writer_mutation(window_label, &root, preparation)
            .map(Some)
            .map_err(crate::error::AppError::Io)
    }

    /// Resolve a mutation path to a canonical parent-bound path before any
    /// blocking I/O. Callers must use the returned path for the operation;
    /// retaining the user-provided spelling would re-open a TOCTOU window.
    pub fn secure_mutation_path(&self, target: &Path) -> Result<PathBuf, crate::error::AppError> {
        let mut cursor = target;
        let mut suffix = Vec::new();
        if std::fs::symlink_metadata(cursor)
            .map(|metadata| metadata.file_type().is_symlink())
            .unwrap_or(false)
        {
            return Err(crate::error::AppError::Io(
                "Writer rejected a symlink mutation target.".into(),
            ));
        }
        while !cursor.exists() {
            let Some(name) = cursor.file_name() else {
                return Err(crate::error::AppError::Io(
                    "Invalid mutation target.".into(),
                ));
            };
            suffix.push(name.to_os_string());
            cursor = cursor
                .parent()
                .ok_or_else(|| crate::error::AppError::Io("Invalid mutation parent.".into()))?;
            if std::fs::symlink_metadata(cursor)
                .map(|metadata| metadata.file_type().is_symlink())
                .unwrap_or(false)
            {
                return Err(crate::error::AppError::Io(
                    "Writer rejected a symlink mutation parent.".into(),
                ));
            }
        }
        let mut canonical = std::fs::canonicalize(cursor)
            .map_err(|error| crate::error::AppError::Io(error.to_string()))?;
        for component in suffix.iter().rev() {
            canonical.push(component);
        }
        Ok(canonical)
    }

    pub fn workspace_root_for_target(&self, target: &Path) -> Option<PathBuf> {
        self.windows
            .read()
            .values()
            .filter_map(|window| {
                let root = window.workspace_root.read().clone()?;
                Self::canonical_target_within_root(target, &root)
                    .ok()
                    .map(|_| root)
            })
            .max_by_key(|root| root.components().count())
    }

    pub fn reject_workspace_mutation_if_active(&self, root: &Path) -> Result<(), String> {
        if self.agent_coordinator.is_workspace_active(root) {
            Err("That Workspace has an active Agent Turn; Writer cannot mutate its settings or registrations.".into())
        } else {
            Ok(())
        }
    }

    fn canonical_target_within_root(target: &Path, root: &Path) -> Result<PathBuf, ()> {
        if !target.is_absolute() {
            return Err(());
        }
        let mut cursor = target;
        let mut suffix = Vec::new();
        if std::fs::symlink_metadata(cursor)
            .map(|metadata| metadata.file_type().is_symlink())
            .unwrap_or(false)
        {
            return Err(());
        }
        while !cursor.exists() {
            let Some(name) = cursor.file_name() else {
                return Err(());
            };
            suffix.push(name.to_os_string());
            let Some(parent) = cursor.parent() else {
                return Err(());
            };
            cursor = parent;
            if std::fs::symlink_metadata(cursor)
                .map(|metadata| metadata.file_type().is_symlink())
                .unwrap_or(false)
            {
                return Err(());
            }
        }
        let mut canonical = std::fs::canonicalize(cursor).map_err(|_| ())?;
        for component in suffix.iter().rev() {
            canonical.push(component);
        }
        canonical.starts_with(root).then_some(canonical).ok_or(())
    }
    pub fn new() -> Self {
        Self {
            windows: RwLock::new(HashMap::new()),
            sessions_file_lock: Mutex::new(()),
            recent_files_lock: Mutex::new(()),
            assistant_registrations_lock: Mutex::new(()),
            assistant_consents_lock: Mutex::new(()),
            assistant_conversations_lock: Mutex::new(()),
            agent_coordinator: Arc::new(AgentCoordinator::default()),
        }
    }

    /// Return the window's state, creating a fresh `WorkspaceState` if this
    /// label is unknown. Called by every Tauri command at the top of its
    /// body after deriving the window label from the invoking webview.
    pub fn get_or_create(&self, label: &str) -> Arc<WorkspaceState> {
        {
            let map = self.windows.read();
            if let Some(state) = map.get(label) {
                return state.clone();
            }
        }
        let mut map = self.windows.write();
        map.entry(label.to_string())
            .or_insert_with(|| Arc::new(WorkspaceState::default()))
            .clone()
    }

    pub fn get(&self, label: &str) -> Option<Arc<WorkspaceState>> {
        self.windows.read().get(label).cloned()
    }

    /// Remove and return a window's state. Called from the window-close
    /// event handler so the watcher's `Drop` runs (stopping FSEvents /
    /// inotify subscriptions) and the index memory is reclaimed.
    pub fn remove(&self, label: &str) -> Option<Arc<WorkspaceState>> {
        let state = self.windows.write().remove(label);
        if let Some(state) = &state {
            state
                .assistant_discovery_epoch
                .fetch_add(1, Ordering::AcqRel);
        }
        state
    }

    /// Find an existing window already hosting or opening `path`. Used to
    /// focus rather than duplicate when the user opens a workspace that's
    /// already open in another window. Pending opens are included so two
    /// quick requests for the same workspace do not race before the new
    /// window hydrates and publishes `workspace_root`.
    pub fn find_by_workspace(&self, path: &Path) -> Option<String> {
        let map = self.windows.read();
        for (label, state) in map.iter() {
            let guard = state.workspace_root.read();
            if let Some(root) = guard.as_deref() {
                if root == path {
                    return Some(label.clone());
                }
            }
            drop(guard);

            if state.has_pending_workspace(path) {
                return Some(label.clone());
            }
        }
        None
    }

    /// Find an existing standalone window already hosting (or about to
    /// host) `path`. Mirrors `find_by_workspace` so repeat opens of the
    /// same file focus the existing compact window instead of duplicating.
    pub fn find_by_standalone_file(&self, path: &Path) -> Option<String> {
        let map = self.windows.read();
        for (label, state) in map.iter() {
            let guard = state.standalone_file.read();
            if guard.as_deref() == Some(path) {
                return Some(label.clone());
            }
            drop(guard);

            if state.has_pending_file(path) {
                return Some(label.clone());
            }
        }
        None
    }

    /// Snapshot of all known window labels. Used by startup code to emit
    /// broadcast-style events without hard-coding labels.
    pub fn labels(&self) -> Vec<String> {
        self.windows.read().keys().cloned().collect()
    }

    /// Snapshot every registered window currently hosting `root`, together
    /// with the exact Rust Workspace incarnation used by Agent Turn routing.
    pub fn workspace_incarnations(&self, root: &Path) -> Vec<(String, u64)> {
        let map = self.windows.read();
        let mut matches = map
            .iter()
            .filter(|(_, state)| state.workspace_root.read().as_deref() == Some(root))
            .map(|(label, state)| (label.clone(), state.workspace_epoch.load(Ordering::Acquire)))
            .collect::<Vec<_>>();
        matches.sort_by(|left, right| left.0.cmp(&right.0));
        matches
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Registers all ancestor directories of a file path into the set.
/// Short-circuits when hitting a directory already in the set (its ancestors are too).
pub fn register_ancestors(dirs: &mut HashSet<PathBuf>, file_path: &Path, root: &Path) {
    let mut dir = file_path.parent();
    while let Some(d) = dir {
        if !dirs.insert(d.to_path_buf()) {
            break;
        }
        if d == root {
            break;
        }
        dir = d.parent();
    }
}

/// Rebuild dirs_with_markdown from the full file index.
pub fn rebuild_dirs_from_index(files: &[IndexedFile], root: &Path) -> HashSet<PathBuf> {
    let mut dirs = HashSet::with_capacity(files.len());
    for file in files {
        register_ancestors(&mut dirs, &file.path, root);
    }
    dirs
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assistant::WriterMutationPreparation;

    #[test]
    fn workspace_transition_invalidates_in_flight_assistant_discovery() {
        let state = WorkspaceState::default();
        state.assistant_discovery_epoch.store(7, Ordering::Release);

        state.invalidate_assistant_discovery();

        assert_eq!(state.assistant_discovery_epoch.load(Ordering::Acquire), 8);
    }

    #[test]
    fn writer_mutation_permit_is_target_scoped_and_atomic_with_turn_reservation() {
        let app_state = AppState::new();
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        std::fs::create_dir(&root).unwrap();
        let root = root.canonicalize().unwrap();
        let window = app_state.get_or_create("writer");
        *window.workspace_root.write() = Some(root.clone());
        let target = root.join("note.md");
        let stale_target = temp.path().join("outside/note.md");
        assert!(app_state
            .begin_writer_mutation("writer", &[stale_target.as_path()], None)
            .is_err());

        let permit = app_state
            .begin_writer_mutation("writer", &[target.as_path()], None)
            .unwrap()
            .unwrap();
        app_state
            .agent_coordinator
            .register_bridge("writer", root.clone(), 0, 4)
            .unwrap();
        assert!(app_state
            .agent_coordinator
            .reserve(root.clone(), &[("writer".into(), 0)])
            .is_err());
        drop(permit);
        let turn = app_state
            .agent_coordinator
            .reserve(root, &[("writer".into(), 0)])
            .unwrap();

        let request = turn.prepare_requests().pop().unwrap();
        assert!(app_state
            .begin_writer_mutation("writer", &[target.as_path()], None)
            .is_err());
        let preparation = WriterMutationPreparation {
            turn_id: request.turn_id,
            workspace_root: request.workspace_root,
            workspace_epoch: request.workspace_epoch,
            participant_token: request.participant_token,
            bridge_id: request.bridge_id,
            request_id: request.request_id,
        };
        let prepare_permit = app_state
            .begin_writer_mutation("writer", &[target.as_path()], Some(&preparation))
            .unwrap()
            .unwrap();
        drop(prepare_permit);
    }

    #[cfg(unix)]
    #[test]
    fn capability_context_survives_workspace_parent_replacement() {
        use std::os::unix::fs::symlink;
        let app_state = AppState::new();
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        let outside = temp.path().join("outside");
        std::fs::create_dir(&root).unwrap();
        std::fs::create_dir(&outside).unwrap();
        let root = root.canonicalize().unwrap();
        let window = app_state.get_or_create("writer");
        *window.workspace_root.write() = Some(root.clone());
        let target = root.join("note.md");
        std::fs::write(&target, "old").unwrap();
        let context = app_state
            .begin_writer_mutation_context("writer", &[target.as_path()], None)
            .unwrap();
        let moved = temp.path().join("workspace-moved");
        std::fs::rename(&root, &moved).unwrap();
        symlink(&outside, &root).unwrap();
        context.dir.write(&context.targets[0], b"new").unwrap();
        assert_eq!(
            std::fs::read_to_string(moved.join("note.md")).unwrap(),
            "new"
        );
        assert!(!outside.join("note.md").exists());
    }

    #[test]
    fn workspace_transition_cannot_overtake_or_admit_a_writer_mutation() {
        let app_state = AppState::new();
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        std::fs::create_dir(&root).unwrap();
        let root = root.canonicalize().unwrap();
        let target = root.join("note.md");
        let window = app_state.get_or_create("writer");
        *window.workspace_root.write() = Some(root.clone());
        let mutation = app_state
            .begin_writer_mutation("writer", &[target.as_path()], None)
            .unwrap()
            .unwrap();

        assert!(app_state
            .agent_coordinator
            .begin_workspace_transition("writer", Some(&root), Some(&root))
            .is_err());
        drop(mutation);

        let transition = app_state
            .agent_coordinator
            .begin_workspace_transition("writer", Some(&root), Some(&root))
            .unwrap();
        assert!(app_state
            .begin_writer_mutation("writer", &[target.as_path()], None)
            .is_err());
        drop(transition);
        assert!(app_state
            .begin_writer_mutation("writer", &[target.as_path()], None)
            .is_ok());
    }

    #[test]
    fn writer_mutation_rejects_parent_escape_and_symlink_escape() {
        let app_state = AppState::new();
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        let outside = temp.path().join("outside");
        std::fs::create_dir(&root).unwrap();
        std::fs::create_dir(&outside).unwrap();
        let root = root.canonicalize().unwrap();
        let window = app_state.get_or_create("writer");
        *window.workspace_root.write() = Some(root.clone());

        let escaped = root.join("../outside.txt");
        assert!(app_state
            .begin_writer_mutation("writer", &[escaped.as_path()], None)
            .is_err());

        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, root.join("linked")).unwrap();
        #[cfg(unix)]
        assert!(app_state
            .begin_writer_mutation("writer", &[root.join("linked/file.md").as_path()], None)
            .is_err());
        assert!(app_state
            .begin_writer_mutation(
                "writer",
                &[
                    root.join("note.md").as_path(),
                    root.join("note-assets").as_path()
                ],
                None,
            )
            .is_ok());
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&outside, root.join("note-assets")).unwrap();
            assert!(app_state
                .begin_writer_mutation(
                    "writer",
                    &[
                        root.join("note.md").as_path(),
                        root.join("note-assets").as_path()
                    ],
                    None,
                )
                .is_err());
        }
    }

    #[test]
    fn standalone_target_inside_active_workspace_is_read_only() {
        let app_state = AppState::new();
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        std::fs::create_dir(&root).unwrap();
        let root = root.canonicalize().unwrap();
        let hosted = app_state.get_or_create("hosted");
        let _compact = app_state.get_or_create("compact");
        *hosted.workspace_root.write() = Some(root.clone());
        app_state
            .agent_coordinator
            .register_bridge("hosted", root.clone(), 1, 1)
            .unwrap();
        let _turn = app_state
            .agent_coordinator
            .reserve(root.clone(), &[("hosted".into(), 1)])
            .unwrap();
        assert!(app_state
            .begin_writer_mutation("compact", &[root.join("note.md").as_path()], None)
            .is_err());
        assert!(app_state
            .begin_writer_mutation(
                "compact",
                &[
                    root.join("note.md").as_path(),
                    root.join("note-assets").as_path()
                ],
                None,
            )
            .is_err());
    }

    #[test]
    fn nested_workspace_uses_most_specific_active_root_for_standalone_mutation() {
        let app = AppState::new();
        let dir = tempfile::tempdir().unwrap();
        let outer = dir.path().join("repo");
        let inner = outer.join("sub");
        std::fs::create_dir_all(&inner).unwrap();
        let outer = outer.canonicalize().unwrap();
        let inner = inner.canonicalize().unwrap();
        *app.get_or_create("outer").workspace_root.write() = Some(outer.clone());
        *app.get_or_create("inner").workspace_root.write() = Some(inner.clone());
        let _standalone = app.get_or_create("standalone");
        app.agent_coordinator
            .register_bridge("inner", inner.clone(), 1, 1)
            .unwrap();
        let _turn = app.agent_coordinator.reserve(inner.clone(), &[]).unwrap();
        assert!(app
            .begin_writer_mutation("standalone", &[inner.join("note.md").as_path()], None)
            .is_err());
    }

    #[test]
    fn workspace_settings_target_is_rejected_during_active_turn() {
        let app_state = AppState::new();
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("workspace");
        std::fs::create_dir(&root).unwrap();
        let root = root.canonicalize().unwrap();
        let window = app_state.get_or_create("writer");
        *window.workspace_root.write() = Some(root.clone());
        app_state
            .agent_coordinator
            .register_bridge("writer", root.clone(), 1, 1)
            .unwrap();
        let _turn = app_state
            .agent_coordinator
            .reserve(root.clone(), &[("writer".into(), 1)])
            .unwrap();
        let config = root.join(".writer/config");
        assert!(app_state
            .begin_writer_mutation("writer", &[config.as_path()], None)
            .is_err());
        assert!(!config.exists());
    }

    #[test]
    fn find_by_workspace_matches_startup_open() {
        let app_state = AppState::new();
        let window_state = app_state.get_or_create("startup-window");
        window_state.set_startup_open(PendingOpenPayload {
            workspace: Some("/tmp/workspace".to_string()),
            file: None,
        });

        assert_eq!(
            app_state.find_by_workspace(Path::new("/tmp/workspace")),
            Some("startup-window".to_string())
        );
    }

    #[test]
    fn find_by_workspace_matches_pending_open() {
        let app_state = AppState::new();
        let window_state = app_state.get_or_create("pending-window");
        window_state.push_pending_open(PendingOpenPayload {
            workspace: Some("/tmp/workspace".to_string()),
            file: None,
        });

        assert_eq!(
            app_state.find_by_workspace(Path::new("/tmp/workspace")),
            Some("pending-window".to_string())
        );
    }

    #[test]
    fn find_by_standalone_file_matches_hosted_and_pending_files() {
        let app_state = AppState::new();
        let hosting = app_state.get_or_create("hosting-window");
        *hosting.standalone_file.write() = Some(PathBuf::from("/tmp/hosted.md"));

        let pending = app_state.get_or_create("pending-window");
        pending.set_startup_open(PendingOpenPayload {
            workspace: None,
            file: Some("/tmp/pending.md".to_string()),
        });

        assert_eq!(
            app_state.find_by_standalone_file(Path::new("/tmp/hosted.md")),
            Some("hosting-window".to_string())
        );
        assert_eq!(
            app_state.find_by_standalone_file(Path::new("/tmp/pending.md")),
            Some("pending-window".to_string())
        );
        assert_eq!(
            app_state.find_by_standalone_file(Path::new("/tmp/other.md")),
            None
        );
    }

    #[test]
    fn workspace_plus_file_payload_does_not_match_standalone_lookup() {
        // A file opened *into a workspace window* must not be claimed by the
        // standalone dedupe — only file-only payloads host standalone files.
        let app_state = AppState::new();
        let state = app_state.get_or_create("workspace-window");
        state.push_pending_open(PendingOpenPayload {
            workspace: Some("/tmp/workspace".to_string()),
            file: Some("/tmp/workspace/a.md".to_string()),
        });

        assert_eq!(
            app_state.find_by_standalone_file(Path::new("/tmp/workspace/a.md")),
            None
        );
    }

    #[test]
    fn pending_open_preserves_distinct_payloads_in_order() {
        let window_state = WorkspaceState::default();
        let first = PendingOpenPayload {
            workspace: Some("/tmp/workspace-a".to_string()),
            file: Some("/tmp/workspace-a/a.md".to_string()),
        };
        let second = PendingOpenPayload {
            workspace: Some("/tmp/workspace-b".to_string()),
            file: Some("/tmp/workspace-b/b.md".to_string()),
        };

        window_state.push_pending_open(first.clone());
        window_state.push_pending_open(second.clone());

        assert_eq!(window_state.pop_pending_open(), Some(first));
        assert_eq!(window_state.pop_pending_open(), Some(second));
        assert_eq!(window_state.pop_pending_open(), None);
    }

    #[test]
    fn pending_open_dedupes_repeated_tail_payload() {
        let window_state = WorkspaceState::default();
        let payload = PendingOpenPayload {
            workspace: Some("/tmp/workspace".to_string()),
            file: Some("/tmp/workspace/a.md".to_string()),
        };

        window_state.push_pending_open(payload.clone());
        window_state.push_pending_open(payload.clone());

        assert_eq!(window_state.pop_pending_open(), Some(payload));
        assert_eq!(window_state.pop_pending_open(), None);
    }

    #[test]
    fn startup_open_cannot_be_seeded_after_take() {
        let window_state = WorkspaceState::default();
        assert_eq!(window_state.take_startup_open(), None);

        let payload = PendingOpenPayload {
            workspace: Some("/tmp/workspace".to_string()),
            file: None,
        };

        assert_eq!(
            window_state.try_set_startup_open(payload.clone()),
            Err(payload)
        );
    }

    #[test]
    fn startup_open_try_seed_preserves_existing_payload() {
        let window_state = WorkspaceState::default();
        let first = PendingOpenPayload {
            workspace: Some("/tmp/workspace-a".to_string()),
            file: None,
        };
        let second = PendingOpenPayload {
            workspace: Some("/tmp/workspace-b".to_string()),
            file: None,
        };

        window_state.set_startup_open(first.clone());

        assert_eq!(
            window_state.try_set_startup_open(second.clone()),
            Err(second)
        );
        assert_eq!(window_state.take_startup_open(), Some(first));
    }
}
