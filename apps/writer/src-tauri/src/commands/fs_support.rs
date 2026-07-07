use crate::document::is_supported_document_path;
use crate::ignore::WorkspaceIgnore;
use crate::state::WorkspaceState;
use std::fs;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::sync::Arc;

/// Extract a document title from a Markdown-family file by reading its first few KB.
/// Priority: YAML frontmatter `title:` field, then leading `# ` heading.
pub(crate) fn extract_title(path: &Path) -> Option<String> {
    use std::io::Read;

    let mut file = fs::File::open(path).ok()?;
    let mut buf = vec![0u8; 4096];
    let n = file.read(&mut buf).ok()?;
    let text = std::str::from_utf8(&buf[..n]).ok()?;

    if let Some(rest) = text
        .strip_prefix("---\n")
        .or_else(|| text.strip_prefix("---\r\n"))
    {
        if let Some(end_pos) = rest.find("\n---\n").or_else(|| rest.find("\n---\r\n")) {
            let yaml_block = &rest[..end_pos];
            for line in yaml_block.lines() {
                let trimmed = line.trim();
                if let Some(value) = trimmed.strip_prefix("title:") {
                    let value = value.trim();
                    let title = value
                        .strip_prefix('"')
                        .and_then(|v| v.strip_suffix('"'))
                        .or_else(|| value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
                        .unwrap_or(value);
                    if !title.is_empty() {
                        return Some(title.to_string());
                    }
                }
            }
            let body_start = end_pos + "\n---\n".len();
            return extract_leading_h1(&rest[body_start..]);
        }
    }

    extract_leading_h1(text)
}

fn extract_leading_h1(text: &str) -> Option<String> {
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(heading) = trimmed.strip_prefix("# ") {
            let title = heading.trim();
            if !title.is_empty() {
                return Some(title.to_string());
            }
        }
        return None;
    }
    None
}

fn dir_contains_markdown_recursive(path: &Path, ignore: Option<&WorkspaceIgnore>) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    for entry in entries.flatten() {
        let ft = entry.file_type();
        let Ok(ft) = ft else { continue };
        let entry_path = entry.path();

        if let Some(ignore) = ignore {
            if ignore.is_ignored(&entry_path, ft.is_dir()) {
                continue;
            }
        }

        if ft.is_file() {
            if is_supported_document_path(&entry_path) {
                return true;
            }
        } else if ft.is_dir() && dir_contains_markdown_recursive(&entry_path, ignore) {
            return true;
        }
    }
    false
}

/// O(1) check via the pre-built set, with recursive fallback during initial indexing.
pub(crate) fn dir_contains_markdown(path: &Path, state: Option<&WorkspaceState>) -> bool {
    if let Some(state) = state {
        if state.index_ready.load(Ordering::Relaxed) {
            return state.dirs_with_markdown.read().contains(path);
        }
        let ignore_arc: Option<Arc<WorkspaceIgnore>> =
            state.workspace_ignore.read().as_ref().map(Arc::clone);
        return dir_contains_markdown_recursive(path, ignore_arc.as_deref());
    }
    dir_contains_markdown_recursive(path, None)
}
