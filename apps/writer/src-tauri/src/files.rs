use crate::{
    errors::{to_io_error, AppResult},
    models::{MarkdownFile, WriteMarkdownFileInput, WriterDocument},
};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

pub fn list_documents(app: &AppHandle) -> AppResult<Vec<WriterDocument>> {
    let dir = documents_dir(app)?;
    ensure_dir(&dir)?;

    let mut documents = fs::read_dir(&dir)
        .map_err(to_io_error)?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "json"))
        .filter_map(|entry| read_document_file(&entry.path()).ok())
        .collect::<Vec<_>>();

    documents.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(documents)
}

pub fn get_document(app: &AppHandle, id: &str) -> AppResult<WriterDocument> {
    let path = document_path(&documents_dir(app)?, id)?;
    read_document_file(&path)
}

pub fn save_document(app: &AppHandle, document: &WriterDocument) -> AppResult<WriterDocument> {
    let dir = documents_dir(app)?;
    ensure_dir(&dir)?;
    let path = document_path(&dir, &document.id)?;
    let json = serde_json::to_string_pretty(document).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(to_io_error)?;
    Ok(document.clone())
}

pub fn delete_document(app: &AppHandle, id: &str) -> AppResult<()> {
    let path = document_path(&documents_dir(app)?, id)?;
    if path.exists() {
        fs::remove_file(path).map_err(to_io_error)?;
    }
    Ok(())
}

pub fn read_markdown_file(path: &Path) -> AppResult<MarkdownFile> {
    let source = fs::read_to_string(path).map_err(to_io_error)?;
    Ok(MarkdownFile {
        path: path.to_string_lossy().to_string(),
        source,
    })
}

pub fn write_markdown_file(input: &WriteMarkdownFileInput) -> AppResult<MarkdownFile> {
    let path = Path::new(&input.path);
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(path, &input.source).map_err(to_io_error)?;
    Ok(MarkdownFile {
        path: input.path.clone(),
        source: input.source.clone(),
    })
}

pub fn documents_dir(app: &AppHandle) -> AppResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("documents"))
        .map_err(|error| error.to_string())
}

pub fn ensure_dir(path: &Path) -> AppResult<()> {
    fs::create_dir_all(path).map_err(to_io_error)
}

fn document_path(dir: &Path, id: &str) -> AppResult<PathBuf> {
    if id.trim().is_empty() || id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err("Invalid document id".to_string());
    }

    Ok(dir.join(format!("{id}.json")))
}

fn read_document_file(path: &Path) -> AppResult<WriterDocument> {
    let source = fs::read_to_string(path).map_err(to_io_error)?;
    serde_json::from_str(&source).map_err(|error| error.to_string())
}
