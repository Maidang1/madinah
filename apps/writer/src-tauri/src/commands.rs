use crate::{
    acp, assets, blog, drafts,
    errors::AppResult,
    file_tree, files,
    models::{
        AcpAgentCheckResult, AcpAgentRuntimeConfig, AcpPolishInput, AcpPolishResult,
        AssetImageUploadInput, AssetImageUploadResult, AssetUploadCheckResult, AssetUploadSettings,
        ExportDocumentInput, ExportResult, FileTreeEntry, ImportedBlogFile, MarkdownFile,
        ResolvedPlugin, TrustInput, TrustRecord, TrustedPluginBundle, TrustedPluginBundleInput,
        WorkspaceInfo, WriteMarkdownFileInput, WriterDocument,
    },
    plugins, recent, workspace,
};
use std::path::Path;
use tauri::AppHandle;

#[tauri::command]
pub fn list_documents(app: AppHandle) -> AppResult<Vec<WriterDocument>> {
    files::list_documents(&app)
}

#[tauri::command]
pub fn get_document(app: AppHandle, id: String) -> AppResult<WriterDocument> {
    files::get_document(&app, &id)
}

#[tauri::command]
pub fn save_document(app: AppHandle, document: WriterDocument) -> AppResult<WriterDocument> {
    files::save_document(&app, &document)
}

#[tauri::command]
pub fn delete_document(app: AppHandle, id: String) -> AppResult<()> {
    files::delete_document(&app, &id)
}

#[tauri::command]
pub fn read_markdown_file(path: String) -> AppResult<MarkdownFile> {
    files::read_markdown_file(Path::new(&path))
}

#[tauri::command]
pub fn write_markdown_file(input: WriteMarkdownFileInput) -> AppResult<MarkdownFile> {
    files::write_markdown_file(&input)
}

#[tauri::command]
pub fn list_file_tree(root: String) -> AppResult<Vec<FileTreeEntry>> {
    file_tree::list_markdown_tree(Path::new(&root))
}

#[tauri::command]
pub fn create_file_tree_file(parent_path: String, name: String) -> AppResult<MarkdownFile> {
    file_tree::create_markdown_file(Path::new(&parent_path), &name)
}

#[tauri::command]
pub fn create_file_tree_directory(parent_path: String, name: String) -> AppResult<FileTreeEntry> {
    file_tree::create_directory(Path::new(&parent_path), &name)
}

#[tauri::command]
pub fn reveal_file_tree_path(path: String) -> AppResult<()> {
    file_tree::reveal_in_file_manager(Path::new(&path))
}

#[tauri::command]
pub fn rename_file_tree_path(path: String, name: String) -> AppResult<FileTreeEntry> {
    file_tree::rename_path(Path::new(&path), &name)
}

#[tauri::command]
pub fn duplicate_file_tree_file(path: String) -> AppResult<MarkdownFile> {
    file_tree::duplicate_markdown_file(Path::new(&path))
}

#[tauri::command]
pub fn move_file_tree_path_to_trash(workspace_root: String, path: String) -> AppResult<String> {
    file_tree::move_path_to_trash(Path::new(&workspace_root), Path::new(&path))
}

#[tauri::command]
pub fn read_draft(app: AppHandle, path: String) -> AppResult<Option<MarkdownFile>> {
    drafts::read_draft(&app, &path)
}

#[tauri::command]
pub fn write_draft(app: AppHandle, input: WriteMarkdownFileInput) -> AppResult<MarkdownFile> {
    drafts::write_draft(&app, &input)
}

#[tauri::command]
pub fn list_recent_files(app: AppHandle) -> AppResult<Vec<MarkdownFile>> {
    recent::list_recent_files(&app)
}

#[tauri::command]
pub fn add_recent_file(app: AppHandle, path: String) -> AppResult<()> {
    recent::add_recent_file(&app, &path)
}

#[tauri::command]
pub fn import_blog_dir(path: String) -> AppResult<Vec<ImportedBlogFile>> {
    blog::import_blog_dir(Path::new(&path))
}

#[tauri::command]
pub fn export_document_to_blog(input: ExportDocumentInput) -> AppResult<ExportResult> {
    blog::export_document_to_blog(&input)
}

#[tauri::command]
pub fn resolve_workspace(path: String) -> AppResult<WorkspaceInfo> {
    workspace::resolve_workspace_for_path(Path::new(&path))
}

#[tauri::command]
pub fn resolve_workspace_plugins(
    app: AppHandle,
    workspace_root: String,
) -> AppResult<Vec<ResolvedPlugin>> {
    let trust_path = plugins::trust_path(&app)?;
    plugins::resolve_workspace_plugins_from_root_with_trust(
        Path::new(&workspace_root),
        Some(&trust_path),
    )
}

#[tauri::command]
pub fn read_trusted_plugin_bundle(
    app: AppHandle,
    input: TrustedPluginBundleInput,
) -> AppResult<TrustedPluginBundle> {
    let trust_path = plugins::trust_path(&app)?;
    plugins::read_trusted_plugin_bundle_from_file(&trust_path, &input)
}

#[tauri::command]
pub fn set_workspace_plugin_trust(app: AppHandle, input: TrustInput) -> AppResult<TrustRecord> {
    let trust_path = plugins::trust_path(&app)?;
    plugins::set_plugin_trust_in_file(&trust_path, input)
}

#[tauri::command]
pub async fn polish_text_with_acp(input: AcpPolishInput) -> AppResult<AcpPolishResult> {
    acp::polish_text(input).await
}

#[tauri::command]
pub async fn check_acp_agent(input: AcpAgentRuntimeConfig) -> AppResult<AcpAgentCheckResult> {
    acp::check_agent(input).await
}

#[tauri::command]
pub fn load_asset_upload_settings(app: AppHandle) -> AppResult<AssetUploadSettings> {
    assets::load_settings(&app)
}

#[tauri::command]
pub fn save_asset_upload_settings(
    app: AppHandle,
    settings: AssetUploadSettings,
) -> AppResult<AssetUploadSettings> {
    assets::save_settings(&app, &settings)
}

#[tauri::command]
pub async fn check_asset_upload_settings(
    app: AppHandle,
    settings: AssetUploadSettings,
) -> AppResult<AssetUploadCheckResult> {
    assets::check_settings(&app, settings).await
}

#[tauri::command]
pub async fn upload_asset_image(
    app: AppHandle,
    input: AssetImageUploadInput,
) -> AppResult<AssetImageUploadResult> {
    assets::upload_image(&app, input).await
}
