pub mod blog;
pub mod commands;
pub mod drafts;
pub mod errors;
pub mod file_tree;
pub mod files;
pub mod menu;
pub mod models;
pub mod plugins;
pub mod recent;
pub mod watcher;
pub mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(watcher::FileWatcherState::default())
        .menu(menu::writer_menu)
        .on_menu_event(|app, event| {
            menu::emit_menu_command(app, &event.id().0);
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_documents,
            commands::get_document,
            commands::save_document,
            commands::delete_document,
            commands::read_markdown_file,
            commands::write_markdown_file,
            commands::list_file_tree,
            commands::create_file_tree_file,
            commands::create_file_tree_directory,
            commands::reveal_file_tree_path,
            commands::rename_file_tree_path,
            commands::duplicate_file_tree_file,
            commands::move_file_tree_path_to_trash,
            watcher::watch_file_tree,
            watcher::unwatch_file_tree,
            commands::read_draft,
            commands::write_draft,
            commands::list_recent_files,
            commands::add_recent_file,
            commands::import_blog_dir,
            commands::export_document_to_blog,
            commands::resolve_workspace,
            commands::resolve_workspace_plugins,
            commands::read_trusted_plugin_bundle,
            commands::set_workspace_plugin_trust,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Madinah Writer");
}

#[cfg(test)]
mod tests {
    use crate::blog::{export_path_for_slug, resolve_blogs_dir};
    use crate::menu::menu_item_command_id;

    #[test]
    fn resolve_blogs_dir_accepts_repo_root() {
        let temp = tempfile::tempdir().expect("create temp dir");
        let blogs = temp.path().join("src").join("blogs");
        std::fs::create_dir_all(&blogs).expect("create blogs dir");

        assert_eq!(resolve_blogs_dir(temp.path()), blogs);
    }

    #[test]
    fn export_path_for_slug_rejects_traversal() {
        let temp = tempfile::tempdir().expect("create temp dir");

        assert!(export_path_for_slug(temp.path(), "../escape").is_err());
        assert_eq!(
            export_path_for_slug(temp.path(), "notes/async")
                .expect("valid nested slug")
                .strip_prefix(temp.path())
                .expect("relative path"),
            std::path::Path::new("notes/async.mdx"),
        );
    }

    #[test]
    fn menu_item_ids_map_to_writer_command_ids() {
        assert_eq!(
            menu_item_command_id("writer-menu-document-open"),
            Some("document.open")
        );
        assert_eq!(
            menu_item_command_id("writer-menu-document-save-as"),
            Some("document.saveAs")
        );
        assert_eq!(menu_item_command_id("unknown"), None);
    }
}
