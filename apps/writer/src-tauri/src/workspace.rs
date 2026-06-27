use crate::{
    errors::{to_io_error, AppResult},
    models::{WorkspaceConfig, WorkspaceInfo},
};
use std::{
    fs,
    path::{Path, PathBuf},
};

const CONFIG_DIR: &str = ".madinah-writer";
const CONFIG_FILE: &str = "config.json";

pub fn resolve_workspace_for_path(path: &Path) -> AppResult<WorkspaceInfo> {
    let start = workspace_search_start(path);

    for ancestor in start.ancestors() {
        let config_path = workspace_config_path(ancestor);
        if config_path.exists() {
            return workspace_info_from_config(ancestor.to_path_buf(), config_path);
        }
    }

    for ancestor in start.ancestors() {
        if ancestor.join("package.json").exists() {
            return Ok(default_workspace_info(ancestor.to_path_buf()));
        }
    }

    Ok(default_workspace_info(start.to_path_buf()))
}

pub fn read_workspace_config(root: &Path) -> AppResult<WorkspaceConfig> {
    let path = workspace_config_path(root);
    if !path.exists() {
        return Ok(default_workspace_config());
    }

    let source = fs::read_to_string(&path).map_err(to_io_error)?;
    serde_json::from_str(&source).map_err(|error| error.to_string())
}

pub fn workspace_config_path(root: &Path) -> PathBuf {
    root.join(CONFIG_DIR).join(CONFIG_FILE)
}

fn workspace_info_from_config(root: PathBuf, config_path: PathBuf) -> AppResult<WorkspaceInfo> {
    let source = fs::read_to_string(&config_path).map_err(to_io_error)?;
    let config: WorkspaceConfig = serde_json::from_str(&source).map_err(|error| error.to_string())?;

    Ok(WorkspaceInfo {
        root,
        config_path: Some(config_path),
        profile: config.profile,
        plugins: config.plugins,
    })
}

fn default_workspace_info(root: PathBuf) -> WorkspaceInfo {
    let config = default_workspace_config();
    WorkspaceInfo {
        root,
        config_path: None,
        profile: config.profile,
        plugins: config.plugins,
    }
}

fn default_workspace_config() -> WorkspaceConfig {
    WorkspaceConfig {
        schema_version: 1,
        profile: "gfm".to_string(),
        plugins: Vec::new(),
    }
}

fn workspace_search_start(path: &Path) -> &Path {
    if path.is_file() || path.extension().is_some() {
        return path.parent().unwrap_or(path);
    }

    path
}
