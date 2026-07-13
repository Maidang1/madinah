use crate::error::AppError;
use crate::state::AppState;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::process::Command;

const BLOG_CONTENT_COMPONENTS: [&str; 2] = ["src", "blogs"];

#[derive(Debug, Serialize)]
pub struct PublishResult {
    pub status: &'static str,
    pub commit: String,
    pub branch: String,
    pub upstream: String,
}

fn validate_publish_path(root: &Path, file_path: &Path) -> Result<PathBuf, AppError> {
    let root = root
        .canonicalize()
        .map_err(|error| AppError::Io(error.to_string()))?;
    let file = file_path
        .canonicalize()
        .map_err(|error| AppError::Io(error.to_string()))?;
    let relative = file
        .strip_prefix(&root)
        .map_err(|_| AppError::Invalid("Article must be inside the open workspace.".into()))?;

    let mut components = relative.components();
    for expected in BLOG_CONTENT_COMPONENTS {
        let actual = components
            .next()
            .and_then(|component| component.as_os_str().to_str());
        if actual != Some(expected) {
            return Err(AppError::Invalid(
                "Article must be inside src/blogs.".into(),
            ));
        }
    }

    let extension = relative
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase);
    if !matches!(extension.as_deref(), Some("md" | "mdx")) {
        return Err(AppError::Invalid(
            "Only Markdown and MDX articles can be published.".into(),
        ));
    }

    Ok(relative.to_path_buf())
}

async fn git(root: &Path, args: &[&str]) -> Result<String, AppError> {
    let output = Command::new("git")
        .current_dir(root)
        .args(args)
        .output()
        .await
        .map_err(|error| AppError::Invalid(format!("Unable to run Git: {error}")))?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let detail = if stderr.is_empty() {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    } else {
        stderr
    };
    Err(AppError::Invalid(if detail.is_empty() {
        format!("Git command failed: git {}", args.join(" "))
    } else {
        detail
    }))
}

async fn publish_document_impl(
    workspace_root: PathBuf,
    file_path: PathBuf,
) -> Result<PublishResult, AppError> {
    let workspace_root = workspace_root
        .canonicalize()
        .map_err(|error| AppError::Io(error.to_string()))?;
    let canonical_file = file_path
        .canonicalize()
        .map_err(|error| AppError::Io(error.to_string()))?;
    if !canonical_file.starts_with(&workspace_root) {
        return Err(AppError::Invalid(
            "Article must be inside the open workspace.".into(),
        ));
    }

    let repository_root = git(&workspace_root, &["rev-parse", "--show-toplevel"]).await?;
    let repository_root = PathBuf::from(repository_root)
        .canonicalize()
        .map_err(|error| AppError::Io(error.to_string()))?;
    let relative = validate_publish_path(&repository_root, &canonical_file)?;
    let relative_string = relative.to_string_lossy().to_string();

    let branch = git(&repository_root, &["rev-parse", "--abbrev-ref", "HEAD"]).await?;
    if branch == "HEAD" {
        return Err(AppError::Invalid(
            "Publishing requires a checked-out branch.".into(),
        ));
    }
    let upstream = git(
        &repository_root,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ],
    )
    .await
    .map_err(|_| {
        AppError::Invalid(format!(
            "Branch {branch} has no upstream. Configure one before publishing."
        ))
    })?;
    let remote_key = format!("branch.{branch}.remote");
    let merge_key = format!("branch.{branch}.merge");
    let remote = git(&repository_root, &["config", "--get", &remote_key]).await?;
    let merge_ref = git(&repository_root, &["config", "--get", &merge_key]).await?;

    let status = git(
        &repository_root,
        &[
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
            "--",
            &relative_string,
        ],
    )
    .await?;

    let publish_status = if status.is_empty() {
        "unchanged"
    } else {
        git(&repository_root, &["add", "--", &relative_string]).await?;
        git(
            &repository_root,
            &["diff", "--cached", "--check", "--", &relative_string],
        )
        .await?;

        let route = relative
            .strip_prefix(Path::new("src/blogs"))
            .unwrap_or(&relative)
            .with_extension("")
            .to_string_lossy()
            .to_string();
        let message = format!("Publish {route}");
        git(
            &repository_root,
            &["commit", "--only", "-m", &message, "--", &relative_string],
        )
        .await?;
        "published"
    };

    let commit = git(&repository_root, &["rev-parse", "HEAD"]).await?;
    let push_refspec = format!("HEAD:{merge_ref}");
    git(&repository_root, &["push", &remote, &push_refspec])
        .await
        .map_err(|error| {
            AppError::Invalid(format!(
                "Article was committed locally as {}. Push failed: {error}",
                &commit[..commit.len().min(12)]
            ))
        })?;

    Ok(PublishResult {
        status: publish_status,
        commit,
        branch,
        upstream,
    })
}

#[tauri::command]
pub async fn publish_document(
    file_path: String,
    webview: tauri::Webview,
    app: tauri::AppHandle,
) -> Result<PublishResult, AppError> {
    let state = app.state::<AppState>().get_or_create(webview.label());
    let root = state
        .workspace_root
        .read()
        .clone()
        .ok_or(AppError::NoWorkspace)?;
    publish_document_impl(root, PathBuf::from(file_path)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command as StdCommand;
    use tempfile::tempdir;

    fn run_git(root: &Path, args: &[&str]) {
        let output = StdCommand::new("git")
            .current_dir(root)
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn accepts_only_blog_markdown_inside_the_workspace() {
        let workspace = tempdir().unwrap();
        let blog_dir = workspace.path().join("src/blogs");
        fs::create_dir_all(&blog_dir).unwrap();
        let article = blog_dir.join("hello.mdx");
        fs::write(&article, "article").unwrap();
        assert_eq!(
            validate_publish_path(workspace.path(), &article).unwrap(),
            PathBuf::from("src/blogs/hello.mdx")
        );

        let note = workspace.path().join("note.md");
        fs::write(&note, "note").unwrap();
        assert!(validate_publish_path(workspace.path(), &note).is_err());
    }

    #[tokio::test]
    async fn publishes_from_a_nested_blog_workspace_and_preserves_other_changes() {
        let workspace = tempdir().unwrap();
        let remote_parent = tempdir().unwrap();
        let remote = remote_parent.path().join("remote.git");
        fs::create_dir_all(workspace.path().join("src/blogs")).unwrap();

        run_git(
            remote_parent.path(),
            &["init", "--bare", remote.to_str().unwrap()],
        );
        run_git(workspace.path(), &["init", "-b", "main"]);
        run_git(workspace.path(), &["config", "user.name", "Writer Test"]);
        run_git(
            workspace.path(),
            &["config", "user.email", "writer@example.com"],
        );
        fs::write(workspace.path().join("README.md"), "base").unwrap();
        run_git(workspace.path(), &["add", "README.md"]);
        run_git(workspace.path(), &["commit", "-m", "Initial"]);
        run_git(
            workspace.path(),
            &["remote", "add", "origin", remote.to_str().unwrap()],
        );
        run_git(workspace.path(), &["push", "-u", "origin", "main"]);

        let article = workspace.path().join("src/blogs/hello.md");
        fs::write(&article, "---\ntitle: Hello\n---\nBody").unwrap();
        fs::write(workspace.path().join("README.md"), "unrelated change").unwrap();
        run_git(workspace.path(), &["add", "README.md"]);

        let blog_workspace = workspace.path().join("src/blogs");
        let result = publish_document_impl(blog_workspace.clone(), article)
            .await
            .unwrap();
        assert_eq!(result.status, "published");

        let article_status = StdCommand::new("git")
            .current_dir(workspace.path())
            .args(["status", "--porcelain=v1", "--", "src/blogs/hello.md"])
            .output()
            .unwrap();
        assert!(article_status.stdout.is_empty());

        let unrelated_status = StdCommand::new("git")
            .current_dir(workspace.path())
            .args(["status", "--porcelain=v1", "--", "README.md"])
            .output()
            .unwrap();
        assert!(!unrelated_status.stdout.is_empty());
        assert!(String::from_utf8_lossy(&unrelated_status.stdout).starts_with("M "));

        let unchanged =
            publish_document_impl(blog_workspace, workspace.path().join("src/blogs/hello.md"))
                .await
                .unwrap();
        assert_eq!(unchanged.status, "unchanged");
    }
}
