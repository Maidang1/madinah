use crate::{
    errors::{to_io_error, AppResult},
    files::ensure_dir,
    models::{FileTreeEntry, MarkdownFile},
};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub fn list_markdown_tree(root: &Path) -> AppResult<Vec<FileTreeEntry>> {
    if !root.exists() {
        return Err(format!("Directory not found: {}", root.display()));
    }
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", root.display()));
    }

    list_children(root)
}

pub fn create_markdown_file(parent: &Path, name: &str) -> AppResult<MarkdownFile> {
    if !parent.is_dir() {
        return Err(format!("Not a directory: {}", parent.display()));
    }

    let name = validate_child_name(name)?;
    if !is_markdown_path(Path::new(&name)) {
        return Err("Only Markdown files can be created".to_string());
    }

    let path = parent.join(&name);
    if path.exists() {
        return Err(format!("{} already exists", path.display()));
    }

    let title = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("Untitled")
        .trim()
        .to_string();
    let source = format!("# {}\n\n", if title.is_empty() { "Untitled" } else { &title });
    fs::write(&path, &source).map_err(to_io_error)?;

    Ok(MarkdownFile {
        path: path.to_string_lossy().to_string(),
        source,
    })
}

pub fn create_directory(parent: &Path, name: &str) -> AppResult<FileTreeEntry> {
    if !parent.is_dir() {
        return Err(format!("Not a directory: {}", parent.display()));
    }

    let name = validate_child_name(name)?;
    let path = parent.join(&name);
    if path.exists() {
        return Err(format!("{} already exists", path.display()));
    }

    fs::create_dir(&path).map_err(to_io_error)?;
    entry_for_path(&path)
}

pub fn reveal_in_file_manager(path: &Path) -> AppResult<()> {
    if !path.exists() {
        return Err(format!("Path not found: {}", path.display()));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(to_io_error)?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path.display()))
            .spawn()
            .map_err(to_io_error)?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let target = if path.is_dir() {
            path
        } else {
            path.parent().unwrap_or(path)
        };
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(to_io_error)?;
        Ok(())
    }
}

pub fn rename_path(path: &Path, name: &str) -> AppResult<FileTreeEntry> {
    if !path.exists() {
        return Err(format!("Path not found: {}", path.display()));
    }

    let name = validate_child_name(name)?;
    if path.is_file() && !is_markdown_path(Path::new(&name)) {
        return Err("Only Markdown files can be renamed in the file tree".to_string());
    }

    let parent = path
        .parent()
        .ok_or_else(|| format!("Cannot rename root path: {}", path.display()))?;
    let target = parent.join(name);
    if target.exists() {
        return Err(format!("{} already exists", target.display()));
    }

    fs::rename(path, &target).map_err(to_io_error)?;
    entry_for_path(&target)
}

pub fn duplicate_markdown_file(path: &Path) -> AppResult<MarkdownFile> {
    if !path.is_file() || !is_markdown_path(path) {
        return Err(format!("Not a Markdown file: {}", path.display()));
    }

    let source = fs::read_to_string(path).map_err(to_io_error)?;
    let target = next_duplicate_path(path)?;
    fs::write(&target, &source).map_err(to_io_error)?;

    Ok(MarkdownFile {
        path: target.to_string_lossy().to_string(),
        source,
    })
}

pub fn move_path_to_trash(workspace_root: &Path, path: &Path) -> AppResult<String> {
    if !workspace_root.is_dir() {
        return Err(format!("Workspace not found: {}", workspace_root.display()));
    }
    if !path.exists() {
        return Err(format!("Path not found: {}", path.display()));
    }

    let canonical_root = workspace_root.canonicalize().map_err(to_io_error)?;
    let canonical_path = path.canonicalize().map_err(to_io_error)?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("Path is outside the workspace".to_string());
    }

    let trash_dir = workspace_root.join(".madinah-writer").join("trash");
    ensure_dir(&trash_dir)?;

    let original_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid path name".to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let base = format!("{timestamp}-{original_name}");
    let target = unique_path(&trash_dir.join(base));

    fs::rename(path, &target).map_err(to_io_error)?;
    Ok(target.to_string_lossy().to_string())
}

fn list_children(parent: &Path) -> AppResult<Vec<FileTreeEntry>> {
    let mut entries = fs::read_dir(parent)
        .map_err(to_io_error)?
        .filter_map(Result::ok)
        .filter_map(|entry| entry_for_visible_path(&entry.path()).transpose())
        .collect::<AppResult<Vec<_>>>()?;

    entries.sort_by(|left, right| match (left.kind.as_str(), right.kind.as_str()) {
        ("directory", "file") => std::cmp::Ordering::Less,
        ("file", "directory") => std::cmp::Ordering::Greater,
        _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
    });

    Ok(entries)
}

fn entry_for_visible_path(path: &Path) -> AppResult<Option<FileTreeEntry>> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();

    if path.is_dir() {
        if should_ignore_directory(name) {
            return Ok(None);
        }
        return entry_for_path(path).map(Some);
    }

    if path.is_file() && is_markdown_path(path) {
        return entry_for_path(path).map(Some);
    }

    Ok(None)
}

fn entry_for_path(path: &Path) -> AppResult<FileTreeEntry> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_string();

    if path.is_dir() {
        let children = list_children(path)?;
        return Ok(FileTreeEntry {
            path: path.to_string_lossy().to_string(),
            name,
            kind: "directory".to_string(),
            children_count: children.len(),
            children,
        });
    }

    Ok(FileTreeEntry {
        path: path.to_string_lossy().to_string(),
        name,
        kind: "file".to_string(),
        children_count: 0,
        children: Vec::new(),
    })
}

fn should_ignore_directory(name: &str) -> bool {
    name.starts_with('.') || matches!(name, "node_modules")
}

fn validate_child_name(name: &str) -> AppResult<String> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed == "."
        || trimmed == ".."
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains("..")
    {
        return Err("Invalid file name".to_string());
    }

    Ok(trimmed.to_string())
}

pub(crate) fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| matches!(ext.to_ascii_lowercase().as_str(), "md" | "mdx" | "markdown"))
}

fn next_duplicate_path(path: &Path) -> AppResult<PathBuf> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Cannot duplicate root path: {}", path.display()))?;
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?;
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .ok_or_else(|| "Invalid file extension".to_string())?;

    let first = parent.join(format!("{stem} copy.{extension}"));
    if !first.exists() {
        return Ok(first);
    }

    for index in 2.. {
        let candidate = parent.join(format!("{stem} copy {index}.{extension}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    unreachable!("duplicate loop always returns")
}

fn unique_path(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }

    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("item");
    let extension = path.extension().and_then(|extension| extension.to_str());

    for index in 2.. {
        let name = match extension {
            Some(extension) => format!("{stem}-{index}.{extension}"),
            None => format!("{stem}-{index}"),
        };
        let candidate = parent.join(name);
        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!("unique path loop always returns")
}
