use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, Wry,
};

pub const WRITER_COMMAND_EVENT: &str = "writer-command";

pub fn writer_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let new_document = MenuItemBuilder::with_id("writer-menu-document-new", "New Document")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open = MenuItemBuilder::with_id("writer-menu-document-open", "Open...")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save = MenuItemBuilder::with_id("writer-menu-document-save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as = MenuItemBuilder::with_id("writer-menu-document-save-as", "Save As...")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let revert = MenuItemBuilder::with_id("writer-menu-document-revert", "Revert").build(app)?;
    let close = MenuItemBuilder::with_id("writer-menu-document-close", "Close")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;
    let search = MenuItemBuilder::with_id("writer-menu-document-search", "Find")
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let file = SubmenuBuilder::new(app, "File")
        .item(&new_document)
        .item(&open)
        .separator()
        .item(&save)
        .item(&save_as)
        .separator()
        .item(&revert)
        .item(&close)
        .build()?;

    let bold = MenuItemBuilder::with_id("writer-menu-editor-bold", "Bold")
        .accelerator("CmdOrCtrl+B")
        .build(app)?;
    let italic = MenuItemBuilder::with_id("writer-menu-editor-italic", "Italic")
        .accelerator("CmdOrCtrl+I")
        .build(app)?;
    let link = MenuItemBuilder::with_id("writer-menu-editor-link", "Link")
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&bold)
        .item(&italic)
        .item(&link)
        .separator()
        .item(&search)
        .build()?;

    let command_palette =
        MenuItemBuilder::with_id("writer-menu-view-command-palette", "Command Palette")
            .accelerator("CmdOrCtrl+Shift+P")
            .build(app)?;
    let quick_open = MenuItemBuilder::with_id("writer-menu-view-quick-open", "Quick Open")
        .accelerator("CmdOrCtrl+P")
        .build(app)?;
    let toggle_sidebar =
        MenuItemBuilder::with_id("writer-menu-view-toggle-sidebar", "Toggle Sidebar")
            .accelerator("CmdOrCtrl+Alt+S")
            .build(app)?;
    let toggle_inspector =
        MenuItemBuilder::with_id("writer-menu-view-toggle-inspector", "Toggle Inspector")
            .accelerator("CmdOrCtrl+Alt+I")
            .build(app)?;
    let focus_mode =
        MenuItemBuilder::with_id("writer-menu-view-focus-mode", "Focus Mode")
            .accelerator("CmdOrCtrl+Alt+F")
            .build(app)?;
    let typewriter_mode =
        MenuItemBuilder::with_id("writer-menu-view-typewriter-mode", "Typewriter Mode")
            .accelerator("CmdOrCtrl+Alt+T")
            .build(app)?;
    let write_mode = MenuItemBuilder::with_id("writer-menu-view-write", "Write Mode").build(app)?;
    let preview_mode =
        MenuItemBuilder::with_id("writer-menu-view-preview", "Preview Mode").build(app)?;
    let source_mode =
        MenuItemBuilder::with_id("writer-menu-view-source", "Source Mode").build(app)?;
    let inspector_outline =
        MenuItemBuilder::with_id("writer-menu-inspector-outline", "Outline").build(app)?;
    let inspector_properties =
        MenuItemBuilder::with_id("writer-menu-inspector-properties", "Properties").build(app)?;
    let inspector_stats =
        MenuItemBuilder::with_id("writer-menu-inspector-stats", "Writing Stats").build(app)?;
    let inspector_history =
        MenuItemBuilder::with_id("writer-menu-inspector-history", "History").build(app)?;
    let inspector = SubmenuBuilder::new(app, "Inspector")
        .item(&inspector_outline)
        .item(&inspector_properties)
        .item(&inspector_stats)
        .item(&inspector_history)
        .build()?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&command_palette)
        .item(&quick_open)
        .separator()
        .item(&write_mode)
        .item(&preview_mode)
        .item(&source_mode)
        .separator()
        .item(&toggle_sidebar)
        .item(&toggle_inspector)
        .item(&inspector)
        .separator()
        .item(&focus_mode)
        .item(&typewriter_mode)
        .build()?;

    let outline = MenuItemBuilder::with_id("writer-menu-go-outline", "Outline")
        .accelerator("CmdOrCtrl+Alt+O")
        .build(app)?;
    let go = SubmenuBuilder::new(app, "Go").item(&outline).build()?;

    let window = SubmenuBuilder::new(app, "Window").build()?;
    let help = SubmenuBuilder::new(app, "Help").build()?;

    MenuBuilder::new(app)
        .item(&file)
        .item(&edit)
        .item(&view)
        .item(&go)
        .item(&window)
        .item(&help)
        .build()
}

pub fn emit_menu_command(app: &AppHandle, menu_item_id: &str) {
    if let Some(command_id) = menu_item_command_id(menu_item_id) {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit(WRITER_COMMAND_EVENT, command_id);
        }
    }
}

pub fn menu_item_command_id(menu_item_id: &str) -> Option<&'static str> {
    match menu_item_id {
        "writer-menu-document-new" => Some("document.new"),
        "writer-menu-document-open" => Some("document.open"),
        "writer-menu-document-save" => Some("document.save"),
        "writer-menu-document-save-as" => Some("document.saveAs"),
        "writer-menu-document-revert" => Some("document.revert"),
        "writer-menu-document-close" => Some("document.close"),
        "writer-menu-editor-bold" => Some("editor.format.bold"),
        "writer-menu-editor-italic" => Some("editor.format.italic"),
        "writer-menu-editor-link" => Some("editor.format.link"),
        "writer-menu-document-search" => Some("document.search"),
        "writer-menu-view-command-palette" => Some("view.commandPalette"),
        "writer-menu-view-quick-open" => Some("view.quickOpen"),
        "writer-menu-view-toggle-sidebar" => Some("view.toggleSidebar"),
        "writer-menu-view-toggle-inspector" => Some("view.toggleInspector"),
        "writer-menu-view-focus-mode" => Some("view.focusMode"),
        "writer-menu-view-typewriter-mode" => Some("view.typewriterMode"),
        "writer-menu-view-write" => Some("view.write"),
        "writer-menu-view-preview" => Some("view.preview"),
        "writer-menu-view-source" => Some("view.source"),
        "writer-menu-go-outline" => Some("go.outline"),
        "writer-menu-inspector-outline" => Some("inspector.showOutline"),
        "writer-menu-inspector-properties" => Some("inspector.showProperties"),
        "writer-menu-inspector-stats" => Some("inspector.showStats"),
        "writer-menu-inspector-history" => Some("inspector.showHistory"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::menu_item_command_id;

    #[test]
    fn maps_professional_writer_menu_items_to_frontend_commands() {
        let cases = [
            ("writer-menu-editor-bold", "editor.format.bold"),
            ("writer-menu-document-new", "document.new"),
            ("writer-menu-editor-italic", "editor.format.italic"),
            ("writer-menu-editor-link", "editor.format.link"),
            ("writer-menu-document-search", "document.search"),
            ("writer-menu-view-command-palette", "view.commandPalette"),
            ("writer-menu-view-quick-open", "view.quickOpen"),
            ("writer-menu-view-toggle-sidebar", "view.toggleSidebar"),
            ("writer-menu-view-toggle-inspector", "view.toggleInspector"),
            ("writer-menu-view-focus-mode", "view.focusMode"),
            ("writer-menu-view-typewriter-mode", "view.typewriterMode"),
            ("writer-menu-view-write", "view.write"),
            ("writer-menu-view-preview", "view.preview"),
            ("writer-menu-view-source", "view.source"),
            ("writer-menu-go-outline", "go.outline"),
            ("writer-menu-inspector-outline", "inspector.showOutline"),
            ("writer-menu-inspector-properties", "inspector.showProperties"),
            ("writer-menu-inspector-stats", "inspector.showStats"),
            ("writer-menu-inspector-history", "inspector.showHistory"),
        ];

        for (menu_id, command_id) in cases {
            assert_eq!(menu_item_command_id(menu_id), Some(command_id));
        }
    }
}
