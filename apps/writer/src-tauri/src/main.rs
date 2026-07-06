// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;
use std::process::ExitCode;

/// Multi-call dispatch: a symlink named `writer` in the user's PATH points
/// at the Writer app binary. When invoked through that symlink, argv[0]'s
/// basename is `writer` and we run the CLI. Invoked as `Writer` (the usual
/// case, direct from the bundle), we run the Tauri app.
fn main() -> ExitCode {
    if is_cli_invocation() {
        let argv: Vec<_> = std::env::args_os().collect();
        let cwd = std::env::current_dir().unwrap_or_else(|_| Path::new(".").into());
        return desktop_lib::writer_cli::run(argv, &cwd, &desktop_lib::writer_cli::SystemLauncher);
    }
    desktop_lib::run();
    ExitCode::SUCCESS
}

fn is_cli_invocation() -> bool {
    let Some(arg0) = std::env::args_os().next() else {
        return false;
    };
    Path::new(&arg0)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|name| name.eq_ignore_ascii_case("writer"))
        .unwrap_or(false)
}
