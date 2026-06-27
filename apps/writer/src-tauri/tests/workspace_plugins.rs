use std::fs;

use writer_lib::{
    plugins::{
        resolve_workspace_plugins_from_root_with_trust, set_plugin_trust_in_file, TrustInput,
    },
    workspace::resolve_workspace_for_path,
};

#[test]
fn resolves_workspace_from_config_before_package_json() {
    let temp = tempfile::tempdir().expect("temp dir");
    let workspace = temp.path().join("project").join("docs");
    fs::create_dir_all(workspace.join(".madinah-writer")).expect("config dir");
    fs::write(
        workspace.join(".madinah-writer").join("config.json"),
        r#"{"schemaVersion":1,"profile":"mdx-compatible","plugins":["./plugins/callouts"]}"#,
    )
    .expect("config");
    fs::write(temp.path().join("project").join("package.json"), "{}").expect("package");
    let file = workspace.join("note.md");
    fs::write(&file, "# Note").expect("file");

    let info = resolve_workspace_for_path(&file).expect("workspace");

    assert_eq!(info.root, workspace);
    assert_eq!(info.profile, "mdx-compatible");
    assert_eq!(info.plugins, vec!["./plugins/callouts"]);
}

#[test]
fn resolves_local_plugin_manifest_and_bundle_hash() {
    let temp = tempfile::tempdir().expect("temp dir");
    let workspace = temp.path();
    write_workspace_plugin(workspace, "export default {};\n");

    let plugins =
        resolve_workspace_plugins_from_root_with_trust(workspace, None).expect("plugins");

    assert_eq!(plugins.len(), 1);
    assert_eq!(plugins[0].id, "local-callouts");
    assert_eq!(plugins[0].version, "1.2.3");
    assert_eq!(plugins[0].capabilities, vec!["remark", "previewComponents"]);
    assert_eq!(plugins[0].bundle_hash.len(), 64);
    assert!(!plugins[0].trusted);
}

#[test]
fn bundle_hash_change_requires_trust_refresh() {
    let temp = tempfile::tempdir().expect("temp dir");
    let workspace = temp.path();
    write_workspace_plugin(workspace, "export default { version: 1 };\n");
    let trust_path = workspace.join(".madinah-writer").join("trust.json");
    let initial =
        resolve_workspace_plugins_from_root_with_trust(workspace, Some(&trust_path))
            .expect("initial");

    set_plugin_trust_in_file(
        &trust_path,
        TrustInput {
            workspace_root: workspace.to_string_lossy().to_string(),
            package_id: "local-callouts".to_string(),
            version: "1.2.3".to_string(),
            bundle_hash: initial[0].bundle_hash.clone(),
            trusted: true,
        },
    )
    .expect("trust");

    let trusted =
        resolve_workspace_plugins_from_root_with_trust(workspace, Some(&trust_path))
            .expect("trusted");
    assert!(trusted[0].trusted);

    fs::write(
        workspace
            .join("plugins")
            .join("callouts")
            .join("dist")
            .join("browser.mjs"),
        "export default { version: 2 };\n",
    )
    .expect("bundle");

    let refreshed =
        resolve_workspace_plugins_from_root_with_trust(workspace, Some(&trust_path))
            .expect("refreshed");
    assert!(!refreshed[0].trusted);
    assert_ne!(refreshed[0].bundle_hash, initial[0].bundle_hash);
}

fn write_workspace_plugin(workspace: &std::path::Path, bundle: &str) {
    fs::create_dir_all(workspace.join(".madinah-writer")).expect("config dir");
    fs::write(
        workspace.join(".madinah-writer").join("config.json"),
        r#"{"schemaVersion":1,"profile":"gfm","plugins":["./plugins/callouts"]}"#,
    )
    .expect("config");
    let plugin = workspace.join("plugins").join("callouts");
    fs::create_dir_all(plugin.join("dist")).expect("plugin dist");
    fs::write(
        plugin.join("package.json"),
        r#"{
          "name":"local-callouts",
          "version":"1.2.3",
          "madinahWriter":{
            "apiVersion":1,
            "entry":"./dist/browser.mjs",
            "capabilities":["remark","previewComponents"]
          }
        }"#,
    )
    .expect("manifest");
    fs::write(plugin.join("dist").join("browser.mjs"), bundle).expect("bundle");
}
