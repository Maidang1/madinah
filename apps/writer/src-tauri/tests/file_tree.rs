use std::fs;

use writer_lib::file_tree::{
    create_directory, create_markdown_file, duplicate_markdown_file, list_markdown_tree,
    move_path_to_trash, rename_path,
};

#[test]
fn lists_only_markdown_files_and_visible_directories() {
    let temp = tempfile::tempdir().expect("temp dir");
    let root = temp.path();

    fs::create_dir_all(root.join("docs").join("nested")).expect("docs");
    fs::create_dir_all(root.join(".git")).expect("git");
    fs::create_dir_all(root.join("node_modules")).expect("node modules");
    fs::create_dir_all(root.join(".madinah-writer").join("trash")).expect("trash");
    fs::create_dir_all(root.join(".hidden")).expect("hidden");
    fs::write(root.join("readme.md"), "# Readme").expect("readme");
    fs::write(root.join("draft.markdown"), "# Draft").expect("draft");
    fs::write(root.join("docs").join("intro.mdx"), "# Intro").expect("intro");
    fs::write(root.join("docs").join("notes.txt"), "ignored").expect("txt");
    fs::write(root.join(".git").join("config.md"), "ignored").expect("git md");
    fs::write(root.join("node_modules").join("pkg.md"), "ignored").expect("module md");
    fs::write(
        root.join(".madinah-writer").join("trash").join("old.md"),
        "ignored",
    )
    .expect("trash md");
    fs::write(root.join(".hidden").join("secret.md"), "ignored").expect("hidden md");

    let tree = list_markdown_tree(root).expect("tree");
    let names = tree.iter().map(|entry| entry.name.as_str()).collect::<Vec<_>>();

    assert_eq!(names, vec!["docs", "draft.markdown", "readme.md"]);
    let docs = tree.iter().find(|entry| entry.name == "docs").expect("docs node");
    assert_eq!(docs.children_count, 2);
    assert_eq!(
        docs.children
            .iter()
            .map(|entry| entry.name.as_str())
            .collect::<Vec<_>>(),
        vec!["nested", "intro.mdx"],
    );
}

#[test]
fn creates_renames_duplicates_and_moves_markdown_files_to_trash() {
    let temp = tempfile::tempdir().expect("temp dir");
    let root = temp.path();

    let created = create_markdown_file(root, "New Note.md").expect("create");
    assert_eq!(created.source, "# New Note\n\n");

    assert!(create_markdown_file(root, "../escape.md").is_err());

    let renamed = rename_path(&root.join("New Note.md"), "Renamed.md").expect("rename");
    assert_eq!(renamed.name, "Renamed.md");
    assert!(root.join("Renamed.md").exists());

    fs::write(root.join("Renamed copy.md"), "existing").expect("existing copy");
    let duplicated = duplicate_markdown_file(&root.join("Renamed.md")).expect("duplicate");
    assert_eq!(duplicated.path, root.join("Renamed copy 2.md").to_string_lossy());
    assert_eq!(duplicated.source, "# New Note\n\n");

    let trash_path = move_path_to_trash(root, &root.join("Renamed.md")).expect("trash");
    assert!(!root.join("Renamed.md").exists());
    assert!(trash_path.contains(".madinah-writer/trash"));
    assert_eq!(fs::read_to_string(trash_path).expect("trash content"), "# New Note\n\n");
}

#[test]
fn creates_directories_and_rejects_duplicates() {
    let temp = tempfile::tempdir().expect("temp dir");
    let root = temp.path();

    let created = create_directory(root, "Guides").expect("create dir");
    assert_eq!(created.name, "Guides");
    assert_eq!(created.kind, "directory");
    assert!(root.join("Guides").is_dir());

    assert!(create_directory(root, "Guides").is_err());
    assert!(create_directory(root, "../escape").is_err());
}
