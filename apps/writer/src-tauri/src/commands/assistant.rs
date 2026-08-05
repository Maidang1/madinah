use crate::assistant::{
    add_registration, discover_agents_for_epoch, load_registrations, remove_registration,
    DiscoveryResponse, RegistrationSnapshot,
};
use crate::state::{AppState, WorkspaceState};
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use tauri::{Manager, WebviewWindow};

const REGISTRATION_FILE_NAME: &str = "assistant-agents.json";
const DISCOVERY_TIMEOUT: Duration = Duration::from_secs(5);

#[tauri::command]
pub fn cancel_agent_discovery(window: WebviewWindow, state: tauri::State<'_, AppState>) -> u64 {
    cancel_agent_discovery_for_window(window.label(), &state)
}

fn cancel_agent_discovery_for_window(window_label: &str, state: &AppState) -> u64 {
    state
        .get_or_create(window_label)
        .assistant_discovery_epoch
        .fetch_add(1, Ordering::AcqRel)
        .saturating_add(1)
}

#[tauri::command]
pub async fn discover_agent_runtimes(
    workspace_root: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<DiscoveryResponse, String> {
    discover_agent_runtimes_core(
        workspace_root,
        window.label(),
        registration_path(&app)?,
        &state,
        DISCOVERY_TIMEOUT,
    )
    .await
}

async fn discover_agent_runtimes_core(
    workspace_root: String,
    window_label: &str,
    path: PathBuf,
    state: &AppState,
    timeout: Duration,
) -> Result<DiscoveryResponse, String> {
    let window_state = state.get_or_create(window_label);
    let (canonical_root, request_epoch) =
        begin_workspace_discovery(&workspace_root, &window_state)?;
    let (snapshot, registration_error) = {
        let _guard = state.assistant_registrations_lock.lock();
        match load_registrations(&path) {
            Ok(snapshot) => (snapshot, None),
            Err(error) => (RegistrationSnapshot::default(), Some(error)),
        }
    };

    let response = discover_agents_for_epoch(
        canonical_root,
        snapshot,
        registration_error,
        timeout,
        window_state.assistant_discovery_epoch.clone(),
        request_epoch,
    )
    .await;
    if window_state
        .assistant_discovery_epoch
        .load(Ordering::Acquire)
        != request_epoch
    {
        return Err("Agent discovery was superseded by a newer Workspace request.".into());
    }
    Ok(response)
}

#[tauri::command]
pub fn add_agent_registration(
    workspace_root: String,
    command: String,
    args: Vec<String>,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<RegistrationSnapshot, String> {
    add_agent_registration_core(
        workspace_root,
        command,
        args,
        window.label(),
        registration_path(&app)?,
        &state,
    )
}

fn add_agent_registration_core(
    workspace_root: String,
    command: String,
    args: Vec<String>,
    window_label: &str,
    path: PathBuf,
    state: &AppState,
) -> Result<RegistrationSnapshot, String> {
    let window_state = state.get_or_create(window_label);
    begin_workspace_discovery(&workspace_root, &window_state)?;
    let _guard = state.assistant_registrations_lock.lock();
    add_registration(&path, command, args)
}

#[tauri::command]
pub fn remove_agent_registration(
    workspace_root: String,
    id: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<RegistrationSnapshot, String> {
    remove_agent_registration_core(
        workspace_root,
        id,
        window.label(),
        registration_path(&app)?,
        &state,
    )
}

fn remove_agent_registration_core(
    workspace_root: String,
    id: String,
    window_label: &str,
    path: PathBuf,
    state: &AppState,
) -> Result<RegistrationSnapshot, String> {
    let window_state = state.get_or_create(window_label);
    begin_workspace_discovery(&workspace_root, &window_state)?;
    let _guard = state.assistant_registrations_lock.lock();
    remove_registration(&path, &id)
}

fn registration_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(REGISTRATION_FILE_NAME))
        .map_err(|error| format!("Could not resolve Agent registration storage: {error}"))
}

fn begin_workspace_discovery(
    requested: &str,
    state: &Arc<WorkspaceState>,
) -> Result<(String, u64), String> {
    let requested = Path::new(requested)
        .canonicalize()
        .map_err(|error| format!("Could not resolve the requested Workspace: {error}"))?;
    let current = state.workspace_root.read();
    let current = current
        .as_ref()
        .ok_or_else(|| "Open a Workspace before discovering Agents.".to_string())?;
    if requested != *current {
        return Err("The Workspace changed before Agent discovery could start.".into());
    }
    let request_epoch = state
        .assistant_discovery_epoch
        .fetch_add(1, Ordering::AcqRel)
        .saturating_add(1);
    Ok((current.to_string_lossy().to_string(), request_epoch))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assistant::{build_native_fake_agent, fake_agent_artifact_path, AgentStatus};
    use serde::de::DeserializeOwned;
    use serde_json::{json, Value};
    use std::fs;
    use tauri::test::MockRuntime;

    struct TestRegistrationPath(PathBuf);

    #[tauri::command(rename = "cancel_agent_discovery")]
    fn test_cancel_agent_discovery(
        window: tauri::WebviewWindow<MockRuntime>,
        state: tauri::State<'_, AppState>,
    ) -> u64 {
        cancel_agent_discovery_for_window(window.label(), &state)
    }

    #[tauri::command(rename = "add_agent_registration")]
    fn test_add_agent_registration(
        workspace_root: String,
        command: String,
        args: Vec<String>,
        window: tauri::WebviewWindow<MockRuntime>,
        path: tauri::State<'_, TestRegistrationPath>,
        state: tauri::State<'_, AppState>,
    ) -> Result<RegistrationSnapshot, String> {
        add_agent_registration_core(
            workspace_root,
            command,
            args,
            window.label(),
            path.0.clone(),
            &state,
        )
    }

    #[tauri::command(rename = "remove_agent_registration")]
    fn test_remove_agent_registration(
        workspace_root: String,
        id: String,
        window: tauri::WebviewWindow<MockRuntime>,
        path: tauri::State<'_, TestRegistrationPath>,
        state: tauri::State<'_, AppState>,
    ) -> Result<RegistrationSnapshot, String> {
        remove_agent_registration_core(workspace_root, id, window.label(), path.0.clone(), &state)
    }

    #[tauri::command(rename = "discover_agent_runtimes")]
    async fn test_discover_agent_runtimes(
        workspace_root: String,
        window: tauri::WebviewWindow<MockRuntime>,
        path: tauri::State<'_, TestRegistrationPath>,
        state: tauri::State<'_, AppState>,
    ) -> Result<DiscoveryResponse, String> {
        discover_agent_runtimes_core(
            workspace_root,
            window.label(),
            path.0.clone(),
            &state,
            DISCOVERY_TIMEOUT,
        )
        .await
    }

    fn invoke<T: DeserializeOwned>(
        webview: &tauri::WebviewWindow<MockRuntime>,
        command: &str,
        body: Value,
    ) -> Result<T, Value> {
        tauri::test::get_ipc_response(
            webview,
            tauri::webview::InvokeRequest {
                cmd: command.into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body: tauri::ipc::InvokeBody::Json(body),
                headers: Default::default(),
                invoke_key: tauri::test::INVOKE_KEY.to_string(),
            },
        )
        .map(|response| response.deserialize::<T>().unwrap())
    }

    fn mock_desktop(
        registration_path: PathBuf,
    ) -> (tauri::App<MockRuntime>, tauri::WebviewWindow<MockRuntime>) {
        let app = tauri::test::mock_builder()
            .manage(AppState::new())
            .manage(TestRegistrationPath(registration_path))
            .invoke_handler(tauri::generate_handler![
                test_cancel_agent_discovery,
                test_add_agent_registration,
                test_remove_agent_registration,
                test_discover_agent_runtimes
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "assistant-test", Default::default())
            .build()
            .unwrap();
        (app, webview)
    }

    #[test]
    fn desktop_cancellation_command_invalidates_the_invoking_window() {
        let dir = tempfile::tempdir().unwrap();
        let (app, webview) = mock_desktop(dir.path().join("registrations.json"));
        let response = invoke::<u64>(&webview, "cancel_agent_discovery", json!({})).unwrap();

        assert_eq!(response, 1);
        assert_eq!(
            app.state::<AppState>()
                .get("assistant-test")
                .unwrap()
                .assistant_discovery_epoch
                .load(Ordering::Acquire),
            1
        );
    }

    #[cfg(unix)]
    #[test]
    fn desktop_boundary_registers_discovers_classifies_and_cleans_up_fake_agents() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir(&workspace).unwrap();
        let registration_path = dir.path().join("assistant-agents.json");
        let (app, webview) = mock_desktop(registration_path.clone());
        *app.state::<AppState>()
            .get_or_create(webview.label())
            .workspace_root
            .write() = Some(workspace.canonicalize().unwrap());
        let workspace_root = workspace.to_string_lossy().to_string();

        let mut expected = Vec::new();
        let mut pid_files = Vec::new();
        for (mode, status) in [
            ("compatible", AgentStatus::Compatible),
            ("auth_required", AgentStatus::AuthenticationRequired),
            ("missing_restore", AgentStatus::Incompatible),
            ("malformed", AgentStatus::HandshakeFailed),
        ] {
            let executable = build_native_fake_agent(dir.path(), mode);
            let pid = fake_agent_artifact_path(&executable, "pids");
            let snapshot = invoke::<RegistrationSnapshot>(
                &webview,
                "add_agent_registration",
                json!({
                    "workspaceRoot": workspace_root,
                    "command": executable,
                    "args": ["--stdio"],
                }),
            )
            .unwrap();
            expected.push((snapshot.registrations.last().unwrap().id.clone(), status));
            pid_files.push(pid);
        }
        let missing = build_native_fake_agent(dir.path(), "missing");
        let snapshot = invoke::<RegistrationSnapshot>(
            &webview,
            "add_agent_registration",
            json!({
                "workspaceRoot": workspace_root,
                "command": missing,
                "args": [],
            }),
        )
        .unwrap();
        fs::remove_file(&missing).unwrap();
        expected.push((
            snapshot.registrations.last().unwrap().id.clone(),
            AgentStatus::Missing,
        ));

        let response = invoke::<DiscoveryResponse>(
            &webview,
            "discover_agent_runtimes",
            json!({ "workspaceRoot": workspace_root }),
        )
        .unwrap();

        assert_eq!(
            response.workspace_root,
            workspace.canonicalize().unwrap().to_string_lossy()
        );
        assert_eq!(response.registration_revision, 5);
        assert!(
            registration_path.exists(),
            "registration did not cross storage boundary"
        );
        for (id, status) in expected {
            assert_eq!(
                response
                    .agents
                    .iter()
                    .find(|agent| agent.id == id)
                    .unwrap()
                    .status,
                status,
                "wrong serialized status for registration {id}"
            );
        }
        for pid_file in pid_files {
            assert_process_is_gone(&pid_file);
        }
    }

    #[test]
    fn desktop_registration_boundary_rejects_opaque_values_without_persisting_them() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir(&workspace).unwrap();
        let registration_path = dir.path().join("assistant-agents.json");
        let (app, webview) = mock_desktop(registration_path.clone());
        let executable = std::env::current_exe().unwrap().canonicalize().unwrap();
        *app.state::<AppState>()
            .get_or_create(webview.label())
            .workspace_root
            .write() = Some(workspace.canonicalize().unwrap());

        let error = invoke::<RegistrationSnapshot>(
            &webview,
            "add_agent_registration",
            json!({
                "workspaceRoot": workspace,
                "command": executable,
                "args": ["opaque-secret"],
            }),
        )
        .unwrap_err();

        assert!(error
            .as_str()
            .unwrap()
            .contains("safe valueless ACP transport switches"));
        assert!(!registration_path.exists());
    }

    #[test]
    fn desktop_boundary_enforces_registration_file_and_count_limits() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir(&workspace).unwrap();
        let registration_path = dir.path().join("assistant-agents.json");
        let (app, webview) = mock_desktop(registration_path.clone());
        *app.state::<AppState>()
            .get_or_create(webview.label())
            .workspace_root
            .write() = Some(workspace.canonicalize().unwrap());
        let workspace_root = workspace.to_string_lossy().to_string();
        let executable = std::env::current_exe().unwrap().canonicalize().unwrap();

        fs::write(&registration_path, vec![b' '; 262_145]).unwrap();
        let oversized = invoke::<DiscoveryResponse>(
            &webview,
            "discover_agent_runtimes",
            json!({ "workspaceRoot": workspace_root }),
        )
        .unwrap();
        assert_eq!(oversized.agents.len(), 2);
        assert!(oversized
            .registration_error
            .as_deref()
            .is_some_and(|error| error.contains("262144 bytes")));

        let registrations = |count: usize| {
            (0..count)
                .map(|index| {
                    json!({
                        "id": format!("desktop-agent-{index}"),
                        "command": executable,
                        "args": [],
                    })
                })
                .collect::<Vec<_>>()
        };
        fs::write(
            &registration_path,
            serde_json::to_vec(&json!({
                "version": 1,
                "revision": 32,
                "registrations": registrations(32),
            }))
            .unwrap(),
        )
        .unwrap();
        let before = fs::read(&registration_path).unwrap();
        let add_error = invoke::<RegistrationSnapshot>(
            &webview,
            "add_agent_registration",
            json!({
                "workspaceRoot": workspace_root,
                "command": executable,
                "args": [],
            }),
        )
        .unwrap_err();
        assert!(add_error.as_str().unwrap().contains("at most 32"));
        assert_eq!(fs::read(&registration_path).unwrap(), before);

        fs::write(
            &registration_path,
            serde_json::to_vec(&json!({
                "version": 1,
                "revision": 33,
                "registrations": registrations(33),
            }))
            .unwrap(),
        )
        .unwrap();
        let over_count = invoke::<DiscoveryResponse>(
            &webview,
            "discover_agent_runtimes",
            json!({ "workspaceRoot": workspace_root }),
        )
        .unwrap();
        assert_eq!(over_count.agents.len(), 2);
        assert!(over_count
            .registration_error
            .as_deref()
            .is_some_and(|error| error.contains("at most 32")));
    }

    #[test]
    fn desktop_remove_registration_updates_revision_storage_and_subsequent_discovery() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir(&workspace).unwrap();
        let registration_path = dir.path().join("assistant-agents.json");
        let (app, webview) = mock_desktop(registration_path.clone());
        *app.state::<AppState>()
            .get_or_create(webview.label())
            .workspace_root
            .write() = Some(workspace.canonicalize().unwrap());
        let workspace_root = workspace.to_string_lossy().to_string();
        let executable = std::env::current_exe().unwrap().canonicalize().unwrap();
        let added = invoke::<RegistrationSnapshot>(
            &webview,
            "add_agent_registration",
            json!({
                "workspaceRoot": workspace_root,
                "command": executable,
                "args": [],
            }),
        )
        .unwrap();
        let id = added.registrations[0].id.clone();

        let removed = invoke::<RegistrationSnapshot>(
            &webview,
            "remove_agent_registration",
            json!({ "workspaceRoot": workspace_root, "id": id }),
        )
        .unwrap();
        let stored: RegistrationSnapshot =
            serde_json::from_str(&fs::read_to_string(&registration_path).unwrap()).unwrap();
        let discovered = invoke::<DiscoveryResponse>(
            &webview,
            "discover_agent_runtimes",
            json!({ "workspaceRoot": workspace_root }),
        )
        .unwrap();

        assert_eq!(removed.revision, 2);
        assert!(removed.registrations.is_empty());
        assert_eq!(stored, removed);
        assert_eq!(discovered.registration_revision, 2);
        assert!(discovered.agents.iter().all(|agent| agent.id != id));
    }

    #[cfg(unix)]
    #[test]
    fn desktop_discovery_revalidates_the_native_executable_after_registration() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir(&workspace).unwrap();
        let registration_path = dir.path().join("assistant-agents.json");
        let (app, webview) = mock_desktop(registration_path);
        *app.state::<AppState>()
            .get_or_create(webview.label())
            .workspace_root
            .write() = Some(workspace.canonicalize().unwrap());
        let workspace_root = workspace.to_string_lossy().to_string();
        let executable = build_native_fake_agent(dir.path(), "compatible");
        let added = invoke::<RegistrationSnapshot>(
            &webview,
            "add_agent_registration",
            json!({
                "workspaceRoot": workspace_root,
                "command": executable,
                "args": ["--stdio"],
            }),
        )
        .unwrap();
        let id = added.registrations[0].id.clone();
        fs::write(&executable, "#!/bin/sh\nexit 0\n").unwrap();

        let response = invoke::<DiscoveryResponse>(
            &webview,
            "discover_agent_runtimes",
            json!({ "workspaceRoot": workspace_root }),
        )
        .unwrap();
        let custom = response.agents.iter().find(|agent| agent.id == id).unwrap();

        assert_eq!(custom.status, AgentStatus::HandshakeFailed);
        assert!(custom.message.contains("native executable binding"));
        assert!(custom.message.contains("scripts"));
    }

    #[cfg(unix)]
    #[test]
    fn desktop_cancellation_boundary_promptly_reaps_an_in_flight_probe() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir(&workspace).unwrap();
        let executable = build_native_fake_agent(dir.path(), "hang");
        let registration_path = dir.path().join("assistant-agents.json");
        let (app, webview) = mock_desktop(registration_path);
        *app.state::<AppState>()
            .get_or_create(webview.label())
            .workspace_root
            .write() = Some(workspace.canonicalize().unwrap());
        let workspace_root = workspace.to_string_lossy().to_string();
        let pid = fake_agent_artifact_path(&executable, "pids");
        invoke::<RegistrationSnapshot>(
            &webview,
            "add_agent_registration",
            json!({
                "workspaceRoot": workspace_root,
                "command": executable,
                "args": ["--stdio"],
            }),
        )
        .unwrap();

        let discovery_webview = webview.clone();
        let discovery = std::thread::spawn(move || {
            invoke::<DiscoveryResponse>(
                &discovery_webview,
                "discover_agent_runtimes",
                json!({ "workspaceRoot": workspace_root }),
            )
        });
        let started = std::time::Instant::now();
        while !pid.exists() && started.elapsed() < Duration::from_secs(2) {
            std::thread::sleep(Duration::from_millis(10));
        }
        assert!(pid.exists(), "fake Agent did not start before cancellation");

        let cancelled = invoke::<u64>(&webview, "cancel_agent_discovery", json!({})).unwrap();
        let result = discovery.join().unwrap();

        assert!(cancelled >= 3);
        assert!(result.unwrap_err().as_str().unwrap().contains("superseded"));
        assert_process_is_gone(&pid);
    }

    #[cfg(unix)]
    fn assert_process_is_gone(pid_path: &Path) {
        let pids = fs::read_to_string(pid_path).unwrap();
        for pid in pids.lines() {
            let status = std::process::Command::new("/bin/kill")
                .args(["-0", pid])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .unwrap();
            assert!(
                !status.success(),
                "desktop discovery left process {pid} running"
            );
        }
        fs::remove_file(pid_path).unwrap();
        let request_path = pid_path.with_extension("requests");
        if let Err(error) = fs::remove_file(request_path) {
            assert_eq!(error.kind(), std::io::ErrorKind::NotFound);
        }
    }

    #[test]
    fn workspace_validation_rejects_stale_or_missing_roots() {
        let dir = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let state = Arc::new(WorkspaceState::default());

        assert!(begin_workspace_discovery(dir.path().to_str().unwrap(), &state).is_err());
        *state.workspace_root.write() = Some(dir.path().canonicalize().unwrap());
        assert!(begin_workspace_discovery(other.path().to_str().unwrap(), &state).is_err());
        assert_eq!(
            begin_workspace_discovery(dir.path().to_str().unwrap(), &state)
                .unwrap()
                .0,
            dir.path().canonicalize().unwrap().to_string_lossy()
        );
    }
}
