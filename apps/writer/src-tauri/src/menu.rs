use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, Wry,
};

pub const WRITER_COMMAND_EVENT: &str = "writer-command";

pub fn writer_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
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
    let file = SubmenuBuilder::new(app, "File")
        .item(&open)
        .separator()
        .item(&save)
        .item(&save_as)
        .separator()
        .item(&revert)
        .item(&close)
        .build()?;

    MenuBuilder::new(app).item(&file).build()
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
        "writer-menu-document-open" => Some("document.open"),
        "writer-menu-document-save" => Some("document.save"),
        "writer-menu-document-save-as" => Some("document.saveAs"),
        "writer-menu-document-revert" => Some("document.revert"),
        "writer-menu-document-close" => Some("document.close"),
        _ => None,
    }
}
