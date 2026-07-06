//! Auto-updater state machine, native menu wiring, and release-check plumbing.
//!
//! v1 deliberately keeps the entire user-facing surface in the native app menu
//! and native dialogs — no React components.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tauri::menu::MenuItem;
use tauri::{AppHandle, Manager, WebviewWindow, Wry};
use tauri_plugin_dialog::{
    DialogExt, MessageDialogBuilder, MessageDialogButtons, MessageDialogKind,
};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Pick a window to anchor native dialogs to. Without a parent, `rfd` falls
/// back to `CFUserNotificationDisplayAlert` on macOS, which shows a generic
/// system icon instead of our app icon. Passing any visible window forces the
/// `NSAlert` path, which displays the running app's icon.
fn dialog_parent(app: &AppHandle) -> Option<WebviewWindow> {
    app.webview_windows()
        .into_values()
        .find(|w| w.is_visible().unwrap_or(false))
        .or_else(|| app.webview_windows().into_values().next())
}

fn with_parent<R: tauri::Runtime>(
    mut builder: MessageDialogBuilder<R>,
    parent: Option<&WebviewWindow<R>>,
) -> MessageDialogBuilder<R> {
    if let Some(parent) = parent {
        builder = builder.parent(parent);
    }
    builder
}

const DAILY_CHECK_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);
const DISMISSED_VERSION_FILE: &str = "updater-dismissed-version.json";

/// State machine for the updater lifecycle.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum UpdaterState {
    Idle,
    Checking,
    UpToDate,
    Available { version: String },
    Downloading,
    ReadyToInstall { version: String },
    Error { message: String },
}

/// Menu item handles the state machine rebuilds on each transition.
pub struct UpdaterMenuItems {
    pub check: MenuItem<Wry>,
}

/// Application-managed state that owns the updater lifecycle.
pub struct UpdaterManager {
    state: Mutex<UpdaterState>,
    menu_items: UpdaterMenuItems,
    pending_update: Mutex<Option<Update>>,
    dismissed_version_path: PathBuf,
}

#[derive(Serialize, Deserialize)]
struct DismissedVersionFile {
    dismissed: Option<String>,
}

impl UpdaterManager {
    pub fn new(menu_items: UpdaterMenuItems, app_data_dir: PathBuf) -> Self {
        let dismissed_version_path = app_data_dir.join(DISMISSED_VERSION_FILE);
        let manager = Self {
            state: Mutex::new(UpdaterState::Idle),
            menu_items,
            pending_update: Mutex::new(None),
            dismissed_version_path,
        };
        manager.refresh_menu(&UpdaterState::Idle);
        manager
    }

    fn set_state(&self, new: UpdaterState) {
        self.refresh_menu(&new);
        *self.state.lock() = new;
    }

    /// Atomically transition from a non-busy state to `Checking`. Returns
    /// `false` if the updater was already mid-check or mid-download, so
    /// callers can bail without racing another task.
    fn try_begin_check(&self) -> bool {
        {
            let mut state = self.state.lock();
            if matches!(&*state, UpdaterState::Checking | UpdaterState::Downloading) {
                return false;
            }
            *state = UpdaterState::Checking;
        }
        self.refresh_menu(&UpdaterState::Checking);
        true
    }

    fn refresh_menu(&self, state: &UpdaterState) {
        let (check_text, check_enabled) = match state {
            UpdaterState::Checking => ("Checking for Updates…".to_string(), false),
            UpdaterState::Downloading => ("Downloading Update…".to_string(), false),
            _ => ("Check for Updates…".to_string(), true),
        };

        let _ = self.menu_items.check.set_text(check_text);
        let _ = self.menu_items.check.set_enabled(check_enabled);
    }

    fn read_dismissed_version(&self) -> Option<String> {
        let data = std::fs::read_to_string(&self.dismissed_version_path).ok()?;
        let parsed: DismissedVersionFile = serde_json::from_str(&data).ok()?;
        parsed.dismissed
    }

    fn write_dismissed_version(&self, version: Option<&str>) {
        if let Some(parent) = self.dismissed_version_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let file = DismissedVersionFile {
            dismissed: version.map(|s| s.to_string()),
        };
        if let Ok(json) = serde_json::to_string(&file) {
            let _ = std::fs::write(&self.dismissed_version_path, json);
        }
    }
}

fn manager(app: &AppHandle) -> tauri::State<'_, UpdaterManager> {
    app.state::<UpdaterManager>()
}

/// Trigger a check for updates. `manual = true` surfaces "up to date" and error
/// dialogs; automatic checks stay quiet when there's nothing to do.
pub fn start_check(app: AppHandle, manual: bool) {
    if !manager(&app).try_begin_check() {
        return;
    }

    tauri::async_runtime::spawn(async move {
        let check_result = match app.updater() {
            Ok(updater) => updater.check().await,
            Err(err) => Err(err),
        };

        match check_result {
            Ok(Some(update)) => {
                let version = update.version.clone();
                let notes = update.body.clone();

                if !manual {
                    let dismissed = manager(&app).read_dismissed_version();
                    if dismissed.as_deref() == Some(version.as_str()) {
                        manager(&app).set_state(UpdaterState::UpToDate);
                        return;
                    }
                }

                {
                    let mgr = manager(&app);
                    *mgr.pending_update.lock() = Some(update);
                    mgr.set_state(UpdaterState::Available {
                        version: version.clone(),
                    });
                }

                prompt_install(app.clone(), version, notes);
            }
            Ok(None) => {
                manager(&app).set_state(UpdaterState::UpToDate);
                if manual {
                    let current = app.package_info().version.to_string();
                    let parent = dialog_parent(&app);
                    with_parent(
                        app.dialog()
                            .message(format!(
                                "You're up to date. Writer {} is the latest version.",
                                current
                            ))
                            .kind(MessageDialogKind::Info)
                            .title("Writer"),
                        parent.as_ref(),
                    )
                    .show(|_| {});
                }
            }
            Err(err) => {
                let message = err.to_string();
                manager(&app).set_state(UpdaterState::Error {
                    message: message.clone(),
                });
                if manual {
                    let parent = dialog_parent(&app);
                    with_parent(
                        app.dialog()
                            .message(format!("Could not check for updates.\n\n{}", message))
                            .kind(MessageDialogKind::Error)
                            .title("Writer"),
                        parent.as_ref(),
                    )
                    .show(|_| {});
                }
            }
        }
    });
}

fn prompt_install(app: AppHandle, version: String, notes: Option<String>) {
    let body = match notes.as_deref() {
        Some(notes) if !notes.trim().is_empty() => {
            format!("Writer {} is available.\n\n{}", version, notes.trim())
        }
        _ => format!("Writer {} is available.", version),
    };

    let version_for_dismiss = version.clone();
    let app_for_cb = app.clone();
    let parent = dialog_parent(&app);

    with_parent(
        app.dialog()
            .message(body)
            .kind(MessageDialogKind::Info)
            .title("Update Available")
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Install and Restart".to_string(),
                "Later".to_string(),
            )),
        parent.as_ref(),
    )
    .show(move |accepted| {
        if accepted {
            start_install(app_for_cb);
        } else {
            let mgr = manager(&app_for_cb);
            mgr.write_dismissed_version(Some(&version_for_dismiss));
            mgr.set_state(UpdaterState::Idle);
        }
    });
}

/// Download + install the pending update, then relaunch the app.
pub fn start_install(app: AppHandle) {
    let pending = manager(&app).pending_update.lock().take();

    let Some(update) = pending else {
        return;
    };

    manager(&app).set_state(UpdaterState::Downloading);

    tauri::async_runtime::spawn(async move {
        let version = update.version.clone();
        let result = update
            .download_and_install(|_chunk, _total| {}, || {})
            .await;

        match result {
            Ok(_) => {
                manager(&app).set_state(UpdaterState::ReadyToInstall {
                    version: version.clone(),
                });
                // Clear any previously dismissed version once an install completes.
                manager(&app).write_dismissed_version(None);
                app.restart();
            }
            Err(err) => {
                let message = err.to_string();
                manager(&app).set_state(UpdaterState::Error {
                    message: message.clone(),
                });
                let parent = dialog_parent(&app);
                with_parent(
                    app.dialog()
                        .message(format!("Update failed.\n\n{}", message))
                        .kind(MessageDialogKind::Error)
                        .title("Writer"),
                    parent.as_ref(),
                )
                .show(|_| {});
            }
        }
    });
}

/// Spawn the background task that runs a check once per day while the app is
/// open. The initial at-launch check is triggered separately from `setup`.
pub fn spawn_daily_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(DAILY_CHECK_INTERVAL);
        // The first tick fires immediately — skip it because `setup` already
        // schedules the launch check.
        interval.tick().await;
        loop {
            interval.tick().await;
            start_check(app.clone(), false);
        }
    });
}
