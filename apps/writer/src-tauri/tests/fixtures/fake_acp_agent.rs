use std::fs;
use std::io::{self, BufRead, Write};
use std::process::{Command, Stdio};

fn request_id(line: &str) -> String {
    let marker = "\"id\":";
    let rest = line
        .split_once(marker)
        .map(|(_, rest)| rest.trim_start())
        .expect("fake Agent JSON-RPC request id");
    if let Some(rest) = rest.strip_prefix('"') {
        let end = rest.find('"').expect("fake Agent string request id");
        format!("\"{}\"", &rest[..end])
    } else {
        let end = rest
            .find(|character: char| character == ',' || character == '}')
            .unwrap_or(rest.len());
        rest[..end].to_string()
    }
}

fn respond(id: &str, result: &str) {
    println!(r#"{{"jsonrpc":"2.0","id":{id},"result":{result}}}"#);
    io::stdout().flush().expect("fake Agent stdout flush");
}

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
        "turn_success" | "turn_tail" | "turn_write_fail" | "turn_hang" | "turn_permission"
        | "turn_resume" | "turn_load_fail" => None,
        _ => panic!("unknown fake Agent mode: {mode}"),
    };
    if mode.starts_with("turn_") {
        let initialize_id = request_id(&request);
        respond(
            &initialize_id,
            r#"{"protocolVersion":1,"agentCapabilities":{"loadSession":true},"authMethods":[],"agentInfo":{"name":"Fake Turn ACP","version":"1.0"}}"#,
        );

        request.clear();
        io::stdin()
            .lock()
            .read_line(&mut request)
            .expect("fake Agent session request");
        fs::write(&request_path, format!("{request}\n")).expect("fake Agent session request log");
        let session_rpc_id = request_id(&request);
        if mode == "turn_load_fail" {
            assert!(request.contains("\"method\":\"session/load\""));
            println!(
                r#"{{"jsonrpc":"2.0","id":{session_rpc_id},"error":{{"code":-32001,"message":"session not found"}}}}"#
            );
            io::stdout().flush().expect("fake Agent load failure flush");
            return;
        }
        if mode == "turn_resume" {
            assert!(request.contains("\"method\":\"session/load\""));
            assert!(request.contains("fake-session"));
            respond(&session_rpc_id, r#"{}"#);
        } else {
            assert!(request.contains("\"method\":\"session/new\""));
            respond(&session_rpc_id, r#"{"sessionId":"fake-session"}"#);
        }

        request.clear();
        io::stdin()
            .lock()
            .read_line(&mut request)
            .expect("fake Agent prompt request");
        assert!(request.contains("\"method\":\"session/prompt\""));
        let prompt_id = request_id(&request);
        if mode == "turn_hang" {
            descendant.wait().expect("fake Agent descendant wait");
            return;
        }
        if mode == "turn_permission" {
            println!(
                r#"{{"jsonrpc":"2.0","id":"permission-1","method":"session/request_permission","params":{{"sessionId":"fake-session","toolCall":{{"toolCallId":"external-1","title":"Access the network","kind":"execute","status":"pending"}},"options":[{{"optionId":"allow-once","name":"Allow once","kind":"allow_once"}},{{"optionId":"reject-once","name":"Reject","kind":"reject_once"}}]}}}}"#
            );
            io::stdout().flush().expect("fake Agent permission flush");
            request.clear();
            io::stdin()
                .lock()
                .read_line(&mut request)
                .expect("fake Agent permission response");
            assert!(request.contains("permission-1"));
            assert!(request.contains("allow-once"));
        }
        fs::write("agent-change.md", "# Written by fake Agent\n")
            .expect("fake Agent Workspace write");
        if mode == "turn_write_fail" {
            std::process::exit(70);
        }
        if mode == "turn_tail" {
            respond(&prompt_id, r#"{"stopReason":"end_turn"}"#);
            std::thread::sleep(std::time::Duration::from_millis(75));
        }
        println!(
            r#"{{"jsonrpc":"2.0","method":"session/update","params":{{"sessionId":"fake-session","update":{{"sessionUpdate":"agent_message_chunk","content":{{"type":"text","text":"Turn complete"}}}}}}}}"#
        );
        println!(
            r#"{{"jsonrpc":"2.0","method":"session/update","params":{{"sessionId":"fake-session","update":{{"sessionUpdate":"tool_call","toolCallId":"write-1","title":"Updated agent-change.md","kind":"edit","status":"completed"}}}}}}"#
        );
        io::stdout().flush().expect("fake Agent updates flush");
        if mode != "turn_tail" { respond(&prompt_id, r#"{"stopReason":"end_turn"}"#); }
        if mode == "turn_tail" { return; }
        if mode == "turn_success" { return; }
    } else if let Some(response) = response {
        println!("{response}");
        io::stdout().flush().expect("fake Agent stdout flush");
    }
    descendant.wait().expect("fake Agent descendant wait");
}
