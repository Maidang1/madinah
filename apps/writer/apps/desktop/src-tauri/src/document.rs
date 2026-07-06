use std::path::Path;

pub const SUPPORTED_DOCUMENT_EXTENSIONS: &[&str] = &["md", "mdx", "markdown"];

pub fn is_supported_document_extension(extension: &str) -> bool {
    SUPPORTED_DOCUMENT_EXTENSIONS
        .iter()
        .any(|candidate| extension.eq_ignore_ascii_case(candidate))
}

pub fn is_supported_document_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(is_supported_document_extension)
}
