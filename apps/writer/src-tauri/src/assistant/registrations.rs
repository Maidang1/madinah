use super::{validate_custom_command, validate_stored_custom_registration};
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const REGISTRATION_FILE_VERSION: u32 = 1;
const MAX_REGISTRATION_FILE_BYTES: u64 = 256 * 1024;
pub const MAX_CUSTOM_REGISTRATIONS: usize = 32;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CustomAgentRegistration {
    pub id: String,
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegistrationSnapshot {
    pub version: u32,
    pub revision: u64,
    pub registrations: Vec<CustomAgentRegistration>,
}

impl Default for RegistrationSnapshot {
    fn default() -> Self {
        Self {
            version: REGISTRATION_FILE_VERSION,
            revision: 0,
            registrations: Vec::new(),
        }
    }
}

pub fn load_registrations(path: &Path) -> Result<RegistrationSnapshot, String> {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(RegistrationSnapshot::default());
        }
        Err(error) => {
            return Err(format!("Agent registrations could not be read: {error}"));
        }
    };
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(MAX_REGISTRATION_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Agent registrations could not be read: {error}"))?;
    if bytes.len() as u64 > MAX_REGISTRATION_FILE_BYTES {
        return Err(format!(
            "Agent registrations exceed the {MAX_REGISTRATION_FILE_BYTES} bytes limit."
        ));
    }
    let contents = String::from_utf8(bytes)
        .map_err(|error| format!("Agent registrations could not be read: {error}"))?;

    let snapshot: RegistrationSnapshot = serde_json::from_str(&contents)
        .map_err(|error| format!("Agent registrations could not be read: {error}"))?;
    if snapshot.version != REGISTRATION_FILE_VERSION {
        return Err(format!(
            "Agent registrations use unsupported version {}.",
            snapshot.version
        ));
    }
    validate_registration_count(snapshot.registrations.len())?;
    for registration in &snapshot.registrations {
        validate_stored_custom_registration(&registration.command, &registration.args)?;
    }
    Ok(snapshot)
}

pub fn add_registration(
    path: &Path,
    command: String,
    args: Vec<String>,
) -> Result<RegistrationSnapshot, String> {
    let mut snapshot = load_registrations(path)?;
    if snapshot.registrations.len() >= MAX_CUSTOM_REGISTRATIONS {
        return Err(format!(
            "Writer accepts at most {MAX_CUSTOM_REGISTRATIONS} custom Agent registrations."
        ));
    }
    let revision = next_revision(snapshot.revision)?;
    let command = validate_custom_command(&command, &args)?
        .to_string_lossy()
        .into_owned();
    snapshot.revision = revision;
    snapshot.registrations.push(CustomAgentRegistration {
        id: uuid::Uuid::new_v4().to_string(),
        command,
        args,
    });
    write_snapshot(path, &snapshot)?;
    Ok(snapshot)
}

pub fn remove_registration(path: &Path, id: &str) -> Result<RegistrationSnapshot, String> {
    let mut snapshot = load_registrations(path)?;
    let previous_len = snapshot.registrations.len();
    snapshot
        .registrations
        .retain(|registration| registration.id != id);
    if snapshot.registrations.len() == previous_len {
        return Err("That custom Agent registration no longer exists.".into());
    }
    snapshot.revision = next_revision(snapshot.revision)?;
    write_snapshot(path, &snapshot)?;
    Ok(snapshot)
}

pub fn validate_registration_count(count: usize) -> Result<(), String> {
    if count > MAX_CUSTOM_REGISTRATIONS {
        return Err(format!(
            "Writer accepts at most {MAX_CUSTOM_REGISTRATIONS} custom Agent registrations."
        ));
    }
    Ok(())
}

fn next_revision(revision: u64) -> Result<u64, String> {
    revision.checked_add(1).ok_or_else(|| {
        "Agent registration revision reached its maximum and cannot advance.".to_string()
    })
}

fn write_snapshot(path: &Path, snapshot: &RegistrationSnapshot) -> Result<(), String> {
    write_snapshot_with_parent_sync(path, snapshot, sync_parent_directory)
}

fn write_snapshot_with_parent_sync(
    path: &Path,
    snapshot: &RegistrationSnapshot,
    sync_parent: impl FnOnce(&Path) -> Result<(), std::io::Error>,
) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Agent registration path has no parent directory.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Agent registrations could not be saved: {error}"))?;
    let temp_path = temp_path_for(path);
    let payload = serde_json::to_vec_pretty(snapshot)
        .map_err(|error| format!("Agent registrations could not be saved: {error}"))?;

    let write_result = (|| -> Result<(), std::io::Error> {
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

    if let Err(error) = write_result {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("Agent registrations could not be saved: {error}"));
    }
    let _ = sync_parent(parent);
    Ok(())
}

#[cfg(unix)]
fn sync_parent_directory(parent: &Path) -> Result<(), std::io::Error> {
    File::open(parent)?.sync_all()
}

#[cfg(not(unix))]
fn sync_parent_directory(_parent: &Path) -> Result<(), std::io::Error> {
    Ok(())
}

fn temp_path_for(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("assistant-agents.json");
    path.with_file_name(format!(".{file_name}.{}.tmp", uuid::Uuid::new_v4()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn native_test_executable() -> String {
        std::env::current_exe()
            .unwrap()
            .canonicalize()
            .unwrap()
            .to_string_lossy()
            .into_owned()
    }

    fn snapshot(revision: u64, count: usize) -> RegistrationSnapshot {
        RegistrationSnapshot {
            version: 1,
            revision,
            registrations: (0..count)
                .map(|index| CustomAgentRegistration {
                    id: format!("agent-{index}"),
                    command: native_test_executable(),
                    args: Vec::new(),
                })
                .collect(),
        }
    }

    fn write_raw_snapshot(path: &Path, snapshot: &RegistrationSnapshot) {
        fs::write(path, serde_json::to_vec(snapshot).unwrap()).unwrap();
    }

    #[test]
    fn registration_file_reads_are_bounded() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("assistant-agents.json");
        fs::write(&path, vec![b' '; 262_145]).unwrap();

        let error = load_registrations(&path).unwrap_err();

        assert!(error.contains("262144 bytes"), "unexpected error: {error}");
    }

    #[test]
    fn registration_count_is_bounded_on_load_and_add() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("assistant-agents.json");
        write_raw_snapshot(&path, &snapshot(7, 33));
        let error = load_registrations(&path).unwrap_err();
        assert!(error.contains("at most 32"), "unexpected error: {error}");

        let committed = snapshot(7, 32);
        write_raw_snapshot(&path, &committed);
        let before = fs::read(&path).unwrap();
        let error = add_registration(&path, native_test_executable(), vec![]).unwrap_err();
        assert!(error.contains("at most 32"), "unexpected error: {error}");
        assert_eq!(fs::read(&path).unwrap(), before);
    }

    #[test]
    fn revision_overflow_fails_add_and_remove_without_modifying_storage() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("assistant-agents.json");

        let add_snapshot = snapshot(u64::MAX, 0);
        write_raw_snapshot(&path, &add_snapshot);
        let before_add = fs::read(&path).unwrap();
        let add_error = add_registration(&path, native_test_executable(), vec![]).unwrap_err();
        assert!(add_error.contains("revision"));
        assert_eq!(fs::read(&path).unwrap(), before_add);

        let remove_snapshot = snapshot(u64::MAX, 1);
        let id = remove_snapshot.registrations[0].id.clone();
        write_raw_snapshot(&path, &remove_snapshot);
        let before_remove = fs::read(&path).unwrap();
        let remove_error = remove_registration(&path, &id).unwrap_err();
        assert!(remove_error.contains("revision"));
        assert_eq!(fs::read(&path).unwrap(), before_remove);
    }

    #[test]
    fn parent_sync_failure_does_not_report_a_committed_mutation_as_failed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("assistant-agents.json");
        let snapshot = RegistrationSnapshot::default();

        write_snapshot_with_parent_sync(&path, &snapshot, |_| {
            Err(std::io::Error::other("parent sync failed"))
        })
        .unwrap();

        assert!(path.exists(), "the committed rename must remain visible");
        assert_eq!(load_registrations(&path).unwrap(), snapshot);
    }
}
