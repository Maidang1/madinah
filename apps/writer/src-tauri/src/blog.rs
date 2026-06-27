use crate::{
    errors::{to_io_error, AppResult},
    files::ensure_dir,
    models::{ExportDocumentInput, ExportResult, ImportedBlogFile},
};
use std::{
    fs,
    path::{Path, PathBuf},
};
use walkdir::WalkDir;

pub fn import_blog_dir(path: &Path) -> AppResult<Vec<ImportedBlogFile>> {
    let blogs_dir = resolve_blogs_dir(path);
    if !blogs_dir.exists() {
        return Err(format!("Blog directory not found: {}", blogs_dir.display()));
    }

    let mut files = WalkDir::new(&blogs_dir)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| is_mdx_file(entry.path()))
        .map(|entry| {
            let source = fs::read_to_string(entry.path()).map_err(to_io_error)?;
            let relative = entry
                .path()
                .strip_prefix(&blogs_dir)
                .map_err(|error| error.to_string())?;
            let slug = relative
                .with_extension("")
                .to_string_lossy()
                .replace('\\', "/");

            Ok(ImportedBlogFile {
                slug,
                path: entry.path().to_string_lossy().to_string(),
                source,
            })
        })
        .collect::<AppResult<Vec<_>>>()?;

    files.sort_by(|a, b| a.slug.cmp(&b.slug));
    Ok(files)
}

pub fn export_document_to_blog(input: &ExportDocumentInput) -> AppResult<ExportResult> {
    let blogs_dir = resolve_blogs_dir(Path::new(&input.blog_dir));
    ensure_dir(&blogs_dir)?;

    let output_path = export_path_for_slug(&blogs_dir, &input.slug)?;
    if output_path.exists() && !input.overwrite {
        return Err(format!("{} already exists", output_path.display()));
    }

    if let Some(parent) = output_path.parent() {
        ensure_dir(parent)?;
    }

    fs::write(&output_path, &input.source).map_err(to_io_error)?;

    Ok(ExportResult {
        path: output_path.to_string_lossy().to_string(),
    })
}

pub fn resolve_blogs_dir(path: &Path) -> PathBuf {
    if path.file_name().is_some_and(|name| name == "blogs") {
        return path.to_path_buf();
    }

    let nested = path.join("src").join("blogs");
    if nested.exists() || !path.join("src").exists() {
        return nested;
    }

    path.to_path_buf()
}

pub fn export_path_for_slug(blogs_dir: &Path, slug: &str) -> AppResult<PathBuf> {
    let trimmed = slug.trim().trim_matches('/');
    if trimmed.is_empty() || trimmed.contains("..") {
        return Err("Invalid slug".to_string());
    }

    Ok(blogs_dir.join(format!("{trimmed}.mdx")))
}

fn is_mdx_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| matches!(ext, "md" | "mdx"))
}
