use std::fs;
use std::io::{self, BufRead, Write};
use std::process::{Command, Stdio};

fn main() {
    let executable = std::env::current_exe().expect("fake Agent executable path");
    let name = executable
        .file_name()
        .and_then(|name| name.to_str())
        .expect("fake Agent filename");
    let mode = name.split('-').next().expect("fake Agent mode");
    if mode == "sibling_required" {
        let resource = executable
            .parent()
            .expect("fake Agent executable parent")
            .join("runtime-resource.txt");
        if !resource.exists() {
            eprintln!(
                "required sibling runtime resource is unavailable beside the executable copy"
            );
            std::process::exit(78);
        }
    }
    let pid_path = std::env::temp_dir().join(format!("writer-{name}.pids"));
    let request_path = std::env::temp_dir().join(format!("writer-{name}.requests"));
    let mut descendant = Command::new("/bin/sleep")
        .arg("30")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("fake Agent descendant");
    fs::write(
        &pid_path,
        format!("{}\n{}\n", std::process::id(), descendant.id()),
    )
    .expect("fake Agent pid file");

    let mut request = String::new();
    io::stdin()
        .lock()
        .read_line(&mut request)
        .expect("fake Agent initialize request");
    fs::write(&request_path, &request).expect("fake Agent request log");

    let response = match mode {
        "compatible" => Some(
            r#"{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true},"authMethods":[],"agentInfo":{"name":"Fake ACP","version":"1.0"}}}"#,
        ),
        "missing" => None,
        "missing_restore" => Some(
            r#"{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":false},"authMethods":[],"agentInfo":{"name":"Fake ACP","version":"1.0"}}}"#,
        ),
        "auth_required" => Some(
            r#"{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"Sign in to Fake ACP"}}"#,
        ),
        "malformed" => Some("not-json"),
        "wrong_id" => Some(
            r#"{"jsonrpc":"2.0","id":99,"result":{"protocolVersion":1,"agentCapabilities":{"loadSession":true}}}"#,
        ),
        "hang" => {
            descendant.wait().expect("fake Agent descendant wait");
            None
        }
        _ => panic!("unknown fake Agent mode: {mode}"),
    };
    if let Some(response) = response {
        println!("{response}");
        io::stdout().flush().expect("fake Agent stdout flush");
    }
    descendant.wait().expect("fake Agent descendant wait");
}
