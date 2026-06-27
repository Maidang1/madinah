use crate::{
    errors::{to_io_error, AppResult},
    files::ensure_dir,
    models::{MarkdownFile, WriteMarkdownFileInput},
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

pub fn read_draft(app: &AppHandle, path: &str) -> AppResult<Option<MarkdownFile>> {
    let draft_path = draft_path(app, path)?;
    if !draft_path.exists() {
        return Ok(None);
    }

    let source = fs::read_to_string(&draft_path).map_err(to_io_error)?;
    Ok(Some(MarkdownFile {
        path: path.to_string(),
        source,
    }))
}

pub fn write_draft(app: &AppHandle, input: &WriteMarkdownFileInput) -> AppResult<MarkdownFile> {
    let draft_path = draft_path(app, &input.path)?;
    if let Some(parent) = draft_path.parent() {
        ensure_dir(parent)?;
    }

    fs::write(draft_path, &input.source).map_err(to_io_error)?;
    Ok(MarkdownFile {
        path: input.path.clone(),
        source: input.source.clone(),
    })
}

fn draft_path(app: &AppHandle, path: &str) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("drafts").join(format!("{}.md", hash_path(path))))
        .map_err(|error| error.to_string())
}

fn hash_path(path: &str) -> String {
    let digest = Sha256::digest(path.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[allow(dead_code)]
fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| matches!(ext, "md" | "mdx" | "markdown"))
}
