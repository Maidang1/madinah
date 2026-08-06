use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
#[cfg(unix)]
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

const MAX_COMMAND_BYTES: usize = 4096;
const MAX_CUSTOM_ARGS: usize = 4;
const MAX_CUSTOM_ARG_BYTES: usize = 32;
const MAX_CUSTOM_ARGS_TOTAL_BYTES: usize = 64;
const SAFE_CUSTOM_ARGS: [&str; 2] = ["--stdio", "--acp"];
pub const MAX_CUSTOM_EXECUTABLE_BYTES: u64 = 128 * 1024 * 1024;

#[cfg(test)]
#[derive(Debug, Clone)]
pub struct BindingProgress {
    pub source: PathBuf,
    pub artifact: PathBuf,
    pub copied_bytes: u64,
}

#[cfg(test)]
pub type BindingObserver = Arc<dyn Fn(BindingProgress) + Send + Sync>;

#[derive(Clone)]
pub struct BindingControl {
    cancellation: Option<(Arc<AtomicU64>, u64)>,
    cancellation_message: &'static str,
    #[cfg(test)]
    observer: Option<BindingObserver>,
}

impl BindingControl {
    pub fn new(cancellation: Option<(Arc<AtomicU64>, u64)>) -> Self {
        Self {
            cancellation,
            cancellation_message: "Agent discovery was superseded by a newer Workspace request.",
            #[cfg(test)]
            observer: None,
        }
    }

    pub fn for_turn(cancellation: (Arc<AtomicU64>, u64)) -> Self {
        Self {
            cancellation: Some(cancellation),
            cancellation_message: "Agent Turn cancelled because a Workspace window closed.",
            #[cfg(test)]
            observer: None,
        }
    }

    #[cfg(test)]
    pub fn with_observer(mut self, observer: Option<BindingObserver>) -> Self {
        self.observer = observer;
        self
    }

    fn check_cancelled(&self) -> Result<(), String> {
        if let Some((epoch, expected_epoch)) = &self.cancellation {
            if epoch.load(Ordering::Acquire) != *expected_epoch {
                return Err(self.cancellation_message.into());
            }
        }
        Ok(())
    }

    fn notify(&self, source: &Path, artifact: &Path, copied_bytes: u64) {
        #[cfg(test)]
        if let Some(observer) = &self.observer {
            observer(BindingProgress {
                source: source.to_path_buf(),
                artifact: artifact.to_path_buf(),
                copied_bytes,
            });
        }
        #[cfg(not(test))]
        let _ = (source, artifact, copied_bytes);
    }
}

pub struct BoundCustomExecutable {
    directory: tempfile::TempDir,
    executable: PathBuf,
}

impl BoundCustomExecutable {
    pub fn path(&self) -> &Path {
        &self.executable
    }

    pub fn close(self) -> Result<(), String> {
        self.directory.close().map_err(|error| {
            format!("The private bound Agent executable could not be removed: {error}")
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentSource {
    BuiltIn,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CapabilitySupport {
    ProtocolBaseline,
    Advertised,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCapabilities {
    pub streamed_text: CapabilitySupport,
    pub session_create: CapabilitySupport,
    pub session_restore: CapabilitySupport,
    pub cancellation: CapabilitySupport,
    pub workspace_cwd: CapabilitySupport,
    pub permission_requests: CapabilitySupport,
}

impl Default for AgentCapabilities {
    fn default() -> Self {
        Self {
            streamed_text: CapabilitySupport::ProtocolBaseline,
            session_create: CapabilitySupport::ProtocolBaseline,
            session_restore: CapabilitySupport::Advertised,
            cancellation: CapabilitySupport::ProtocolBaseline,
            workspace_cwd: CapabilitySupport::ProtocolBaseline,
            permission_requests: CapabilitySupport::ProtocolBaseline,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDefinition {
    pub id: String,
    pub name: String,
    pub source: AgentSource,
    pub command: String,
    pub args: Vec<String>,
    pub setup_url: String,
    pub capabilities: AgentCapabilities,
}

pub fn builtin_agents() -> Vec<AgentDefinition> {
    [
        (
            "claude-agent-acp",
            "Claude Agent ACP",
            "claude-agent-acp",
            "https://github.com/zed-industries/claude-agent-acp",
        ),
        (
            "codex-acp",
            "Codex ACP",
            "codex-acp",
            "https://github.com/zed-industries/codex-acp",
        ),
    ]
    .into_iter()
    .map(|(id, name, command, setup_url)| AgentDefinition {
        id: id.into(),
        name: name.into(),
        source: AgentSource::BuiltIn,
        command: command.into(),
        args: Vec::new(),
        setup_url: setup_url.into(),
        capabilities: AgentCapabilities::default(),
    })
    .collect()
}

pub fn validate_custom_command(command: &str, args: &[String]) -> Result<PathBuf, String> {
    validate_stored_custom_registration(command, args)?;
    let input = PathBuf::from(command);
    let link_metadata = fs::symlink_metadata(&input).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "The custom Agent executable does not exist.".to_string()
        } else {
            format!("The custom Agent executable could not be inspected: {error}")
        }
    })?;
    if link_metadata.file_type().is_symlink() {
        return Err("Custom Agent executable symbolic links are not allowed.".into());
    }

    let canonical = input.canonicalize().map_err(|error| {
        format!("The custom Agent executable could not be canonicalized: {error}")
    })?;
    if canonical.as_os_str() != input.as_os_str() {
        return Err(
            "Enter the executable's explicit canonical absolute path; aliases, `.`/`..`, and symlinked parent paths are not allowed."
                .into(),
        );
    }
    let metadata = fs::metadata(&canonical)
        .map_err(|error| format!("The custom Agent executable could not be inspected: {error}"))?;
    if !metadata.is_file() {
        return Err("The custom Agent command must be a regular native executable file.".into());
    }
    validate_executable_size(metadata.len())?;
    #[cfg(unix)]
    if metadata.permissions().mode() & 0o111 == 0 {
        return Err("The custom Agent native file is not executable.".into());
    }
    if !is_native_executable(&canonical).map_err(|error| {
        format!("The custom Agent executable format could not be inspected: {error}")
    })? {
        return Err(
            "The custom Agent command must be a regular native executable; scripts, shebang files, and text wrappers are not allowed."
                .into(),
        );
    }
    if is_dispatcher(&executable_name(&canonical.to_string_lossy())) {
        return Err(
            "Register the installed native ACP executable directly; package runners, shells, and generic dispatchers are not allowed."
                .into(),
        );
    }
    Ok(canonical)
}

pub fn bind_custom_executable(
    command: &str,
    args: &[String],
    control: &BindingControl,
) -> Result<Option<BoundCustomExecutable>, String> {
    control.check_cancelled()?;
    validate_stored_custom_registration(command, args)?;
    let input = PathBuf::from(command);
    let link_metadata = match fs::symlink_metadata(&input) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "The custom Agent executable could not be inspected: {error}"
            ));
        }
    };
    if link_metadata.file_type().is_symlink() {
        return Err("Custom Agent executable symbolic links are not allowed.".into());
    }
    let canonical = input.canonicalize().map_err(|error| {
        format!("The custom Agent executable could not be canonicalized: {error}")
    })?;
    if canonical.as_os_str() != input.as_os_str() {
        return Err(
            "Enter the executable's explicit canonical absolute path; aliases, `.`/`..`, and symlinked parent paths are not allowed."
                .into(),
        );
    }

    let mut source = open_source_without_following_symlinks(&input)?;
    validate_open_native_file(&input, &source)?;
    if is_dispatcher(&executable_name(command)) {
        return Err(
            "Register the installed native ACP executable directly; package runners, shells, and generic dispatchers are not allowed."
                .into(),
        );
    }

    let directory = tempfile::Builder::new()
        .prefix("writer-acp-probe-")
        .tempdir()
        .map_err(|error| {
            format!("Could not create a private Agent executable directory: {error}")
        })?;
    let executable = directory.path().join(
        input
            .file_name()
            .ok_or_else(|| "The custom Agent executable has no filename.".to_string())?,
    );
    let mut options = OpenOptions::new();
    options.create_new(true).write(true);
    #[cfg(unix)]
    options.mode(0o700);
    let mut target = options
        .open(&executable)
        .map_err(|error| format!("Could not create the private bound Agent executable: {error}"))?;
    control.notify(&input, &executable, 0);
    source
        .seek(SeekFrom::Start(0))
        .map_err(|error| format!("Could not bind the custom Agent executable: {error}"))?;
    copy_executable_bounded(
        &mut source,
        &mut target,
        MAX_CUSTOM_EXECUTABLE_BYTES,
        control,
        &input,
        &executable,
    )?;
    control.check_cancelled()?;
    target
        .flush()
        .and_then(|_| target.sync_all())
        .map_err(|error| format!("Could not bind the custom Agent executable: {error}"))?;
    drop(target);
    control.check_cancelled()?;
    let executable = executable.canonicalize().map_err(|error| {
        format!("Could not canonicalize the private bound Agent executable: {error}")
    })?;
    validate_custom_command(&executable.to_string_lossy(), args).map_err(|error| {
        format!("The private bound Agent executable failed validation: {error}")
    })?;
    Ok(Some(BoundCustomExecutable {
        directory,
        executable,
    }))
}

fn copy_executable_bounded(
    source: &mut impl Read,
    target: &mut impl Write,
    limit: u64,
    control: &BindingControl,
    source_path: &Path,
    artifact_path: &Path,
) -> Result<u64, String> {
    const COPY_CHUNK_BYTES: usize = 64 * 1024;

    let mut buffer = [0u8; COPY_CHUNK_BYTES];
    let mut copied = 0u64;
    loop {
        control.check_cancelled()?;
        let remaining = limit
            .checked_sub(copied)
            .ok_or_else(|| "Custom Agent executable copy size overflowed.".to_string())?;
        let bounded_capacity = if remaining == 0 { 1 } else { remaining };
        let read_capacity = usize::try_from(bounded_capacity.min(COPY_CHUNK_BYTES as u64))
            .map_err(|_| "Custom Agent executable copy size overflowed.".to_string())?;
        let read = source
            .read(&mut buffer[..read_capacity])
            .map_err(|error| format!("Could not bind the custom Agent executable: {error}"))?;
        if read == 0 {
            return Ok(copied);
        }
        control.check_cancelled()?;
        let next = copied
            .checked_add(read as u64)
            .ok_or_else(|| "Custom Agent executable copy size overflowed.".to_string())?;
        if next > limit {
            return Err(format!(
                "Custom Agent native executable exceeded the {limit} bytes copy limit."
            ));
        }
        target
            .write_all(&buffer[..read])
            .map_err(|error| format!("Could not bind the custom Agent executable: {error}"))?;
        copied = next;
        control.notify(source_path, artifact_path, copied);
    }
}

#[cfg(unix)]
fn open_source_without_following_symlinks(path: &Path) -> Result<File, String> {
    use std::os::fd::OwnedFd;

    let descriptor: OwnedFd = rustix::fs::open(
        path,
        rustix::fs::OFlags::RDONLY | rustix::fs::OFlags::NOFOLLOW,
        rustix::fs::Mode::empty(),
    )
    .map_err(|error| format!("The custom Agent executable could not be opened safely: {error}"))?;
    Ok(File::from(descriptor))
}

#[cfg(not(unix))]
fn open_source_without_following_symlinks(path: &Path) -> Result<File, String> {
    File::open(path)
        .map_err(|error| format!("The custom Agent executable could not be opened: {error}"))
}

fn validate_open_native_file(path: &Path, file: &File) -> Result<(), String> {
    let metadata = file
        .metadata()
        .map_err(|error| format!("The custom Agent executable could not be inspected: {error}"))?;
    if !metadata.is_file() {
        return Err("The custom Agent command must be a regular native executable file.".into());
    }
    validate_executable_size(metadata.len())?;
    #[cfg(unix)]
    if metadata.permissions().mode() & 0o111 == 0 {
        return Err("The custom Agent native file is not executable.".into());
    }
    let mut inspected = file
        .try_clone()
        .map_err(|error| format!("The custom Agent executable could not be inspected: {error}"))?;
    if !is_native_executable_file(&mut inspected).map_err(|error| {
        format!("The custom Agent executable format could not be inspected: {error}")
    })? {
        return Err(format!(
            "The custom Agent command `{}` must be a regular native executable; scripts, shebang files, and text wrappers are not allowed.",
            path.display()
        ));
    }
    Ok(())
}

fn validate_executable_size(size: u64) -> Result<(), String> {
    if size > MAX_CUSTOM_EXECUTABLE_BYTES {
        return Err("Custom Agent native executables may be at most 128 MiB.".into());
    }
    Ok(())
}

pub fn validate_stored_custom_registration(command: &str, args: &[String]) -> Result<(), String> {
    if command.is_empty() {
        return Err("Enter an ACP executable's canonical absolute path.".into());
    }
    if command.len() > MAX_COMMAND_BYTES {
        return Err(format!(
            "Custom Agent executable paths may contain at most {MAX_COMMAND_BYTES} bytes."
        ));
    }
    if command.contains('\0') {
        return Err("Custom Agent executable paths cannot contain null bytes.".into());
    }
    let path = Path::new(command);
    if !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::CurDir | Component::ParentDir))
    {
        return Err("Enter the executable's explicit canonical absolute path.".into());
    }
    if is_dispatcher(&executable_name(command)) {
        return Err(
            "Register the installed native ACP executable directly; package runners, shells, and generic dispatchers are not allowed."
                .into(),
        );
    }
    validate_safe_args(args)
}

fn validate_safe_args(args: &[String]) -> Result<(), String> {
    if args.len() > MAX_CUSTOM_ARGS {
        return Err(format!(
            "Custom Agent registrations accept at most {MAX_CUSTOM_ARGS} arguments."
        ));
    }
    let mut total_bytes = 0usize;
    for argument in args {
        let bytes = argument.len();
        if bytes > MAX_CUSTOM_ARG_BYTES {
            return Err(format!(
                "Each custom Agent argument may contain at most {MAX_CUSTOM_ARG_BYTES} bytes."
            ));
        }
        total_bytes = total_bytes.checked_add(bytes).ok_or_else(|| {
            "Custom Agent argument size overflowed the validation bound.".to_string()
        })?;
        if total_bytes > MAX_CUSTOM_ARGS_TOTAL_BYTES {
            return Err(format!(
                "Custom Agent arguments may contain at most {MAX_CUSTOM_ARGS_TOTAL_BYTES} bytes in total."
            ));
        }
    }
    for argument in args {
        if !SAFE_CUSTOM_ARGS.contains(&argument.as_str()) {
            return Err(format!(
                "Custom Agent arguments are limited to safe valueless ACP transport switches: {}. Configure models, profiles, and authentication outside Writer.",
                SAFE_CUSTOM_ARGS.join(", ")
            ));
        }
    }
    Ok(())
}

fn executable_name(command: &str) -> String {
    let normalized = command.replace('\\', "/");
    let mut file_name = Path::new(&normalized)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(&normalized)
        .to_ascii_lowercase();
    while let Some(stripped) = [".exe", ".cmd", ".bat", ".com", ".ps1"]
        .into_iter()
        .find_map(|suffix| file_name.strip_suffix(suffix))
    {
        file_name = stripped.to_string();
    }
    file_name
}

fn is_dispatcher(executable: &str) -> bool {
    const DISPATCHERS: [&str; 56] = [
        "env",
        "sh",
        "bash",
        "zsh",
        "dash",
        "ksh",
        "fish",
        "csh",
        "tcsh",
        "cmd",
        "powershell",
        "pwsh",
        "wscript",
        "cscript",
        "busybox",
        "command",
        "exec",
        "sudo",
        "doas",
        "su",
        "runuser",
        "nohup",
        "setsid",
        "xargs",
        "npx",
        "pnpx",
        "bunx",
        "uvx",
        "npm",
        "pnpm",
        "yarn",
        "yarnpkg",
        "bun",
        "corepack",
        "node",
        "deno",
        "python",
        "python3",
        "py",
        "ruby",
        "perl",
        "pipx",
        "uv",
        "cargo",
        "dotnet",
        "java",
        "php",
        "go",
        "docker",
        "podman",
        "flatpak",
        "snap",
        "mise",
        "asdf",
        "direnv",
        "just",
    ];
    DISPATCHERS.contains(&executable)
        || executable.strip_prefix("python").is_some_and(|suffix| {
            !suffix.is_empty() && suffix.chars().all(|ch| ch.is_ascii_digit() || ch == '.')
        })
}

fn is_native_executable(path: &Path) -> Result<bool, std::io::Error> {
    let mut file = File::open(path)?;
    is_native_executable_file(&mut file)
}

fn is_native_executable_file(file: &mut File) -> Result<bool, std::io::Error> {
    file.seek(SeekFrom::Start(0))?;
    let mut magic = [0u8; 4];
    if file.read_exact(&mut magic).is_err() {
        return Ok(false);
    }
    if magic == *b"\x7fELF"
        || matches!(
            magic,
            [0xfe, 0xed, 0xfa, 0xce]
                | [0xce, 0xfa, 0xed, 0xfe]
                | [0xfe, 0xed, 0xfa, 0xcf]
                | [0xcf, 0xfa, 0xed, 0xfe]
                | [0xca, 0xfe, 0xba, 0xbe]
                | [0xbe, 0xba, 0xfe, 0xca]
                | [0xca, 0xfe, 0xba, 0xbf]
                | [0xbf, 0xba, 0xfe, 0xca]
        )
    {
        return Ok(true);
    }
    if magic[..2] != *b"MZ" {
        return Ok(false);
    }

    file.seek(SeekFrom::Start(0x3c))?;
    let mut offset = [0u8; 4];
    file.read_exact(&mut offset)?;
    file.seek(SeekFrom::Start(u32::from_le_bytes(offset).into()))?;
    file.read_exact(&mut magic)?;
    Ok(magic == *b"PE\0\0")
}

#[cfg(test)]
mod binding_tests {
    use super::*;

    #[test]
    fn streaming_copy_rejects_source_growth_at_limit_plus_one_without_writing_the_sentinel() {
        struct GrowingSource {
            bytes: std::io::Cursor<Vec<u8>>,
            appended: bool,
        }

        impl Read for GrowingSource {
            fn read(&mut self, target: &mut [u8]) -> std::io::Result<usize> {
                let read = self.bytes.read(target)?;
                if read == 8 && !self.appended {
                    self.bytes.get_mut().push(0x7f);
                    self.appended = true;
                }
                Ok(read)
            }
        }

        let mut source = GrowingSource {
            bytes: std::io::Cursor::new(vec![0x7f; 8]),
            appended: false,
        };
        let mut target = Vec::new();

        let error = copy_executable_bounded(
            &mut source,
            &mut target,
            8,
            &BindingControl::new(None),
            Path::new("/source"),
            Path::new("/artifact"),
        )
        .unwrap_err();

        assert!(error.contains("8 bytes"), "unexpected error: {error}");
        assert_eq!(target.len(), 8, "limit-plus-one sentinel reached disk");
    }
}
