use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const CONSENT_FILE_VERSION: u32 = 1;
const MAX_CONSENT_FILE_BYTES: u64 = 256 * 1024;
const MAX_CONSENT_WORKSPACES: usize = 1_024;
const MAX_WORKSPACE_PATH_BYTES: usize = 4_096;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConsentSnapshot {
    pub version: u32,
    pub revision: u64,
    pub workspaces: Vec<String>,
}

impl Default for ConsentSnapshot {
    fn default() -> Self {
        Self {
            version: 1,
            revision: 0,
            workspaces: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsentStatus {
    pub workspace_root: String,
    pub granted: bool,
    pub revision: u64,
}

pub fn load_consents(path: &Path) -> Result<ConsentSnapshot, String> {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ConsentSnapshot::default());
        }
        Err(error) => return Err(format!("AI Access Consent could not be read: {error}")),
    };
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(MAX_CONSENT_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("AI Access Consent could not be read: {error}"))?;
    if bytes.len() as u64 > MAX_CONSENT_FILE_BYTES {
        return Err(format!(
            "AI Access Consent exceeds the {MAX_CONSENT_FILE_BYTES} bytes limit."
        ));
    }
    let snapshot: ConsentSnapshot = serde_json::from_slice(&bytes)
        .map_err(|error| format!("AI Access Consent could not be read: {error}"))?;
    validate_snapshot(&snapshot)?;
    Ok(snapshot)
}

pub fn grant_consent(path: &Path, workspace_root: String) -> Result<ConsentSnapshot, String> {
    validate_workspace_root(&workspace_root)?;
    let mut snapshot = load_consents(path)?;
    if snapshot
        .workspaces
        .iter()
        .any(|root| root == &workspace_root)
    {
        return Ok(snapshot);
    }
    if snapshot.workspaces.len() >= MAX_CONSENT_WORKSPACES {
        return Err(format!(
            "Writer stores AI Access Consent for at most {MAX_CONSENT_WORKSPACES} Workspaces."
        ));
    }
    snapshot.revision = snapshot.revision.checked_add(1).ok_or_else(|| {
        "AI Access Consent revision reached its maximum and cannot advance.".to_string()
    })?;
    snapshot.workspaces.push(workspace_root);
    write_snapshot(path, &snapshot)?;
    Ok(snapshot)
}

fn validate_snapshot(snapshot: &ConsentSnapshot) -> Result<(), String> {
    if snapshot.version != CONSENT_FILE_VERSION {
        return Err(format!(
            "AI Access Consent uses unsupported version {}.",
            snapshot.version
        ));
    }
    if snapshot.workspaces.len() > MAX_CONSENT_WORKSPACES {
        return Err(format!(
            "Writer stores AI Access Consent for at most {MAX_CONSENT_WORKSPACES} Workspaces."
        ));
    }
    let mut unique = std::collections::HashSet::with_capacity(snapshot.workspaces.len());
    for workspace_root in &snapshot.workspaces {
        validate_workspace_root(workspace_root)?;
        if !unique.insert(workspace_root) {
            return Err("AI Access Consent contains a duplicate Workspace identity.".into());
        }
    }
    Ok(())
}

fn validate_workspace_root(workspace_root: &str) -> Result<(), String> {
    if workspace_root.is_empty() || workspace_root.len() > MAX_WORKSPACE_PATH_BYTES {
        return Err(format!(
            "AI Access Consent Workspace paths must be 1 to {MAX_WORKSPACE_PATH_BYTES} bytes."
        ));
    }
    if !Path::new(workspace_root).is_absolute() {
        return Err("AI Access Consent requires an absolute canonical Workspace path.".into());
    }
    Ok(())
}

fn write_snapshot(path: &Path, snapshot: &ConsentSnapshot) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "AI Access Consent storage has no parent directory.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("AI Access Consent could not be saved: {error}"))?;
    let temp_path = temp_path_for(path);
    let payload = serde_json::to_vec_pretty(snapshot)
        .map_err(|error| format!("AI Access Consent could not be saved: {error}"))?;
    if payload.len() as u64 + 1 > MAX_CONSENT_FILE_BYTES {
        return Err(format!(
            "AI Access Consent exceeds the {MAX_CONSENT_FILE_BYTES} bytes limit."
        ));
    }

    let result = (|| -> Result<(), std::io::Error> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp_path)?;
        file.write_all(&payload)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        fs::rename(&temp_path, path)?;
        Ok(())
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("AI Access Consent could not be saved: {error}"));
    }
    #[cfg(unix)]
    let _ = File::open(parent).and_then(|directory| directory.sync_all());
    Ok(())
}

fn temp_path_for(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("assistant-consents.json");
    path.with_file_name(format!(".{file_name}.{}.tmp", uuid::Uuid::new_v4()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn consent_reads_and_revision_work_are_bounded_before_mutation() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("assistant-consents.json");
        fs::write(&path, vec![b' '; (MAX_CONSENT_FILE_BYTES + 1) as usize]).unwrap();
        let error = load_consents(&path).unwrap_err();
        assert!(error.contains("bytes limit"), "unexpected error: {error}");

        let overflow = ConsentSnapshot {
            version: CONSENT_FILE_VERSION,
            revision: u64::MAX,
            workspaces: Vec::new(),
        };
        fs::write(&path, serde_json::to_vec(&overflow).unwrap()).unwrap();
        let before = fs::read(&path).unwrap();
        let error = grant_consent(&path, "/workspace".into()).unwrap_err();
        assert!(error.contains("revision"), "unexpected error: {error}");
        assert_eq!(fs::read(&path).unwrap(), before);
    }
}
