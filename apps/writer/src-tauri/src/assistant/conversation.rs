use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const CONVERSATION_INDEX_VERSION: u32 = 1;
const CONVERSATION_RECORD_VERSION: u32 = 1;
const MAX_INDEX_FILE_BYTES: u64 = 512 * 1024;
const MAX_RECORD_FILE_BYTES: u64 = 4 * 1024 * 1024;
const MAX_CONVERSATIONS_TOTAL: usize = 1_024;
const MAX_CONVERSATIONS_PER_WORKSPACE: usize = 64;
const MAX_MESSAGES_PER_CONVERSATION: usize = 256;
const MAX_TURNS_PER_CONVERSATION: usize = 256;
const MAX_PERMISSION_DECISIONS_PER_TURN: usize = 64;
const MAX_WORKSPACE_PATH_BYTES: usize = 4_096;
const MAX_ID_BYTES: usize = 128;
const MAX_NAME_BYTES: usize = 128;
const MAX_AGENT_ID_BYTES: usize = 128;
const MAX_MESSAGE_BYTES: usize = 2 * 1024 * 1024;
const MAX_SUMMARY_BYTES: usize = 4 * 1024;
const MAX_SUMMARIES_PER_TURN: usize = 128;
const MAX_CITATIONS_PER_MESSAGE: usize = 64;
const MAX_CITATION_PATH_BYTES: usize = 4_096;
const MAX_SESSION_ID_BYTES: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConversationIndex {
    pub version: u32,
    pub revision: u64,
    pub conversations: Vec<ConversationSummary>,
    pub workspace_prefs: Vec<WorkspaceAssistantPrefs>,
}

impl Default for ConversationIndex {
    fn default() -> Self {
        Self {
            version: CONVERSATION_INDEX_VERSION,
            revision: 0,
            conversations: Vec::new(),
            workspace_prefs: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConversationSummary {
    pub id: String,
    pub workspace_root: String,
    pub agent_id: String,
    pub name: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub restore_status: ConversationRestoreStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkspaceAssistantPrefs {
    pub workspace_root: String,
    pub last_agent_id: Option<String>,
    pub active_conversation_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConversationRestoreStatus {
    None,
    Active,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConversationRecord {
    pub version: u32,
    pub id: String,
    pub workspace_root: String,
    pub agent_id: String,
    pub name: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub runtime_session_id: Option<String>,
    pub restore_status: ConversationRestoreStatus,
    pub messages: Vec<PersistedMessage>,
    pub turns: Vec<PersistedTurn>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PersistedMessage {
    pub id: String,
    pub role: MessageRole,
    pub content: String,
    pub citations: Vec<PersistedCitation>,
    pub created_at: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MessageRole {
    User,
    Assistant,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PersistedCitation {
    pub path: String,
    pub heading: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PersistedTurn {
    pub turn_id: String,
    pub status: String,
    pub outcome_message: String,
    pub change_summaries: Vec<String>,
    pub permission_decisions: Vec<PersistedPermissionDecision>,
    pub started_at: u64,
    pub finished_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PersistedPermissionDecision {
    pub request_id: String,
    pub title: String,
    pub option_id: Option<String>,
    pub decided_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkspaceConversationSnapshot {
    pub workspace_root: String,
    pub revision: u64,
    pub conversations: Vec<ConversationSummary>,
    pub active_conversation_id: Option<String>,
    pub last_agent_id: Option<String>,
    pub active_conversation: Option<ConversationRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TurnPersistenceInput {
    pub turn_id: String,
    pub prompt: String,
    pub final_reply: String,
    pub status: String,
    pub outcome_message: String,
    pub change_summaries: Vec<String>,
    pub permission_decisions: Vec<PersistedPermissionDecision>,
    pub runtime_session_id: Option<String>,
    pub started_at: u64,
    pub finished_at: u64,
}

pub fn index_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("assistant-conversations.json")
}

pub fn records_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("assistant-conversation-records")
}

pub fn record_path(app_data_dir: &Path, conversation_id: &str) -> PathBuf {
    records_dir(app_data_dir).join(format!("{conversation_id}.json"))
}

pub fn load_index(path: &Path) -> Result<ConversationIndex, String> {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ConversationIndex::default());
        }
        Err(error) => {
            return Err(format!(
                "Assistant Conversations index could not be read: {error}"
            ))
        }
    };
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(MAX_INDEX_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Assistant Conversations index could not be read: {error}"))?;
    if bytes.len() as u64 > MAX_INDEX_FILE_BYTES {
        return Err(format!(
            "Assistant Conversations index exceeds the {MAX_INDEX_FILE_BYTES} bytes limit."
        ));
    }
    let index: ConversationIndex = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Assistant Conversations index could not be read: {error}"))?;
    validate_index(&index)?;
    Ok(index)
}

pub fn load_record(path: &Path) -> Result<ConversationRecord, String> {
    let mut file = File::open(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "That Assistant Conversation no longer exists.".to_string()
        } else {
            format!("Assistant Conversation could not be read: {error}")
        }
    })?;
    let mut bytes = Vec::new();
    Read::by_ref(&mut file)
        .take(MAX_RECORD_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Assistant Conversation could not be read: {error}"))?;
    if bytes.len() as u64 > MAX_RECORD_FILE_BYTES {
        return Err(format!(
            "Assistant Conversation exceeds the {MAX_RECORD_FILE_BYTES} bytes limit."
        ));
    }
    let record: ConversationRecord = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Assistant Conversation could not be read: {error}"))?;
    validate_record(&record)?;
    Ok(record)
}

pub fn list_workspace_conversations(
    app_data_dir: &Path,
    workspace_root: &str,
) -> Result<WorkspaceConversationSnapshot, String> {
    validate_workspace_root(workspace_root)?;
    let index = load_index(&index_path(app_data_dir))?;
    let prefs = index
        .workspace_prefs
        .iter()
        .find(|prefs| prefs.workspace_root == workspace_root)
        .cloned()
        .unwrap_or(WorkspaceAssistantPrefs {
            workspace_root: workspace_root.into(),
            last_agent_id: None,
            active_conversation_id: None,
        });
    let conversations = index
        .conversations
        .into_iter()
        .filter(|summary| summary.workspace_root == workspace_root)
        .collect::<Vec<_>>();
    let active_conversation = match prefs.active_conversation_id.as_deref() {
        Some(id) if conversations.iter().any(|summary| summary.id == id) => {
            Some(load_record(&record_path(app_data_dir, id))?)
        }
        _ => None,
    };
    let active_conversation_id = active_conversation
        .as_ref()
        .map(|record| record.id.clone())
        .or_else(|| conversations.first().map(|summary| summary.id.clone()));
    Ok(WorkspaceConversationSnapshot {
        workspace_root: workspace_root.into(),
        revision: index.revision,
        conversations,
        active_conversation_id,
        last_agent_id: prefs.last_agent_id,
        active_conversation,
    })
}

pub fn create_conversation(
    app_data_dir: &Path,
    workspace_root: String,
    agent_id: String,
    name: Option<String>,
) -> Result<ConversationRecord, String> {
    validate_workspace_root(&workspace_root)?;
    validate_agent_id(&agent_id)?;
    let now = unix_millis();
    let id = uuid::Uuid::new_v4().to_string();
    let name = normalize_name(name, now)?;
    let mut index = load_index(&index_path(app_data_dir))?;
    let workspace_count = index
        .conversations
        .iter()
        .filter(|summary| summary.workspace_root == workspace_root)
        .count();
    if workspace_count >= MAX_CONVERSATIONS_PER_WORKSPACE {
        return Err(format!(
            "Writer stores at most {MAX_CONVERSATIONS_PER_WORKSPACE} Assistant Conversations per Workspace."
        ));
    }
    if index.conversations.len() >= MAX_CONVERSATIONS_TOTAL {
        return Err(format!(
            "Writer stores at most {MAX_CONVERSATIONS_TOTAL} Assistant Conversations."
        ));
    }
    let record = ConversationRecord {
        version: CONVERSATION_RECORD_VERSION,
        id: id.clone(),
        workspace_root: workspace_root.clone(),
        agent_id: agent_id.clone(),
        name: name.clone(),
        created_at: now,
        updated_at: now,
        runtime_session_id: None,
        restore_status: ConversationRestoreStatus::None,
        messages: Vec::new(),
        turns: Vec::new(),
    };
    write_record(&record_path(app_data_dir, &id), &record)?;
    index.revision = next_revision(index.revision)?;
    index.conversations.push(ConversationSummary {
        id: id.clone(),
        workspace_root: workspace_root.clone(),
        agent_id: agent_id.clone(),
        name,
        created_at: now,
        updated_at: now,
        restore_status: ConversationRestoreStatus::None,
    });
    upsert_prefs(
        &mut index,
        &workspace_root,
        Some(agent_id),
        Some(id.clone()),
    );
    write_index(&index_path(app_data_dir), &index)?;
    Ok(record)
}

pub fn rename_conversation(
    app_data_dir: &Path,
    workspace_root: &str,
    conversation_id: &str,
    name: String,
) -> Result<ConversationRecord, String> {
    validate_workspace_root(workspace_root)?;
    validate_id(conversation_id, "conversation")?;
    let name = normalize_name(Some(name), unix_millis())?;
    let mut index = load_index(&index_path(app_data_dir))?;
    let summary = index
        .conversations
        .iter_mut()
        .find(|summary| summary.id == conversation_id)
        .ok_or_else(|| "That Assistant Conversation no longer exists.".to_string())?;
    if summary.workspace_root != workspace_root {
        return Err("That Assistant Conversation belongs to a different Workspace.".into());
    }
    let path = record_path(app_data_dir, conversation_id);
    let mut record = load_record(&path)?;
    if record.workspace_root != workspace_root {
        return Err("That Assistant Conversation belongs to a different Workspace.".into());
    }
    let now = unix_millis();
    record.name = name.clone();
    record.updated_at = now;
    summary.name = name;
    summary.updated_at = now;
    index.revision = next_revision(index.revision)?;
    write_record(&path, &record)?;
    write_index(&index_path(app_data_dir), &index)?;
    Ok(record)
}

pub fn select_conversation(
    app_data_dir: &Path,
    workspace_root: &str,
    conversation_id: &str,
) -> Result<ConversationRecord, String> {
    validate_workspace_root(workspace_root)?;
    validate_id(conversation_id, "conversation")?;
    let mut index = load_index(&index_path(app_data_dir))?;
    let summary = index
        .conversations
        .iter()
        .find(|summary| summary.id == conversation_id)
        .ok_or_else(|| "That Assistant Conversation no longer exists.".to_string())?;
    if summary.workspace_root != workspace_root {
        return Err("That Assistant Conversation belongs to a different Workspace.".into());
    }
    let record = load_record(&record_path(app_data_dir, conversation_id))?;
    index.revision = next_revision(index.revision)?;
    upsert_prefs(
        &mut index,
        workspace_root,
        Some(record.agent_id.clone()),
        Some(conversation_id.into()),
    );
    write_index(&index_path(app_data_dir), &index)?;
    Ok(record)
}

pub fn delete_conversation(
    app_data_dir: &Path,
    workspace_root: &str,
    conversation_id: &str,
) -> Result<WorkspaceConversationSnapshot, String> {
    validate_workspace_root(workspace_root)?;
    validate_id(conversation_id, "conversation")?;
    let mut index = load_index(&index_path(app_data_dir))?;
    let before = index.conversations.len();
    index.conversations.retain(|summary| {
        !(summary.id == conversation_id && summary.workspace_root == workspace_root)
    });
    if index.conversations.len() == before {
        return Err("That Assistant Conversation no longer exists.".into());
    }
    let path = record_path(app_data_dir, conversation_id);
    match fs::remove_file(&path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!(
                "Assistant Conversation could not be deleted: {error}"
            ))
        }
    }
    index.revision = next_revision(index.revision)?;
    if let Some(prefs) = index
        .workspace_prefs
        .iter_mut()
        .find(|prefs| prefs.workspace_root == workspace_root)
    {
        if prefs.active_conversation_id.as_deref() == Some(conversation_id) {
            prefs.active_conversation_id = index
                .conversations
                .iter()
                .filter(|summary| summary.workspace_root == workspace_root)
                .map(|summary| summary.id.clone())
                .next();
        }
    }
    write_index(&index_path(app_data_dir), &index)?;
    list_workspace_conversations(app_data_dir, workspace_root)
}

pub fn remember_last_agent(
    app_data_dir: &Path,
    workspace_root: &str,
    agent_id: &str,
) -> Result<(), String> {
    validate_workspace_root(workspace_root)?;
    validate_agent_id(agent_id)?;
    let mut index = load_index(&index_path(app_data_dir))?;
    index.revision = next_revision(index.revision)?;
    upsert_prefs(&mut index, workspace_root, Some(agent_id.into()), None);
    write_index(&index_path(app_data_dir), &index)?;
    Ok(())
}

pub fn load_conversation_for_workspace(
    app_data_dir: &Path,
    workspace_root: &str,
    conversation_id: &str,
) -> Result<ConversationRecord, String> {
    validate_workspace_root(workspace_root)?;
    validate_id(conversation_id, "conversation")?;
    let index = load_index(&index_path(app_data_dir))?;
    let summary = index
        .conversations
        .iter()
        .find(|summary| summary.id == conversation_id)
        .ok_or_else(|| "That Assistant Conversation no longer exists.".to_string())?;
    if summary.workspace_root != workspace_root {
        return Err("That Assistant Conversation belongs to a different Workspace.".into());
    }
    let record = load_record(&record_path(app_data_dir, conversation_id))?;
    if record.workspace_root != workspace_root {
        return Err("That Assistant Conversation belongs to a different Workspace.".into());
    }
    Ok(record)
}

pub fn mark_session_restore_failed(
    app_data_dir: &Path,
    workspace_root: &str,
    conversation_id: &str,
) -> Result<ConversationRecord, String> {
    mutate_record(app_data_dir, workspace_root, conversation_id, |record| {
        record.restore_status = ConversationRestoreStatus::Failed;
        // Keep runtime_session_id and transcript so the user can still read history.
        Ok(())
    })
}

pub fn append_completed_turn(
    app_data_dir: &Path,
    workspace_root: &str,
    conversation_id: &str,
    input: TurnPersistenceInput,
) -> Result<ConversationRecord, String> {
    mutate_record(app_data_dir, workspace_root, conversation_id, |record| {
        if record.restore_status == ConversationRestoreStatus::Failed {
            return Err(
                "This Assistant Conversation cannot resume its Runtime session; create a new Conversation."
                    .into(),
            );
        }
        if record.messages.len() + 2 > MAX_MESSAGES_PER_CONVERSATION {
            return Err(format!(
                "Writer stores at most {MAX_MESSAGES_PER_CONVERSATION} messages per Conversation."
            ));
        }
        if record.turns.len() >= MAX_TURNS_PER_CONVERSATION {
            return Err(format!(
                "Writer stores at most {MAX_TURNS_PER_CONVERSATION} turns per Conversation."
            ));
        }
        validate_prompt(&input.prompt)?;
        if input.final_reply.len() > MAX_MESSAGE_BYTES {
            return Err(format!(
                "Final Agent reply exceeds the {MAX_MESSAGE_BYTES} bytes limit."
            ));
        }
        if input.change_summaries.len() > MAX_SUMMARIES_PER_TURN {
            return Err(format!(
                "Writer stores at most {MAX_SUMMARIES_PER_TURN} change summaries per turn."
            ));
        }
        for summary in &input.change_summaries {
            if summary.len() > MAX_SUMMARY_BYTES {
                return Err(format!(
                    "Change summaries must be at most {MAX_SUMMARY_BYTES} bytes."
                ));
            }
        }
        if input.permission_decisions.len() > MAX_PERMISSION_DECISIONS_PER_TURN {
            return Err(format!(
                "Writer stores at most {MAX_PERMISSION_DECISIONS_PER_TURN} permission decisions per turn."
            ));
        }
        if let Some(session_id) = &input.runtime_session_id {
            validate_session_id(session_id)?;
        }
        let finished_at = input.finished_at;
        record.messages.push(PersistedMessage {
            id: uuid::Uuid::new_v4().to_string(),
            role: MessageRole::User,
            content: input.prompt,
            citations: Vec::new(),
            created_at: input.started_at,
        });
        if !input.final_reply.is_empty() {
            record.messages.push(PersistedMessage {
                id: uuid::Uuid::new_v4().to_string(),
                role: MessageRole::Assistant,
                content: input.final_reply,
                citations: Vec::new(),
                created_at: finished_at,
            });
        }
        record.turns.push(PersistedTurn {
            turn_id: input.turn_id,
            status: input.status,
            outcome_message: input.outcome_message,
            change_summaries: input.change_summaries,
            permission_decisions: input.permission_decisions,
            started_at: input.started_at,
            finished_at,
        });
        if let Some(session_id) = input.runtime_session_id {
            record.runtime_session_id = Some(session_id);
            if record.restore_status != ConversationRestoreStatus::Failed {
                record.restore_status = ConversationRestoreStatus::Active;
            }
        }
        record.updated_at = finished_at;
        Ok(())
    })
}

fn mutate_record(
    app_data_dir: &Path,
    workspace_root: &str,
    conversation_id: &str,
    mutate: impl FnOnce(&mut ConversationRecord) -> Result<(), String>,
) -> Result<ConversationRecord, String> {
    validate_workspace_root(workspace_root)?;
    validate_id(conversation_id, "conversation")?;
    let mut index = load_index(&index_path(app_data_dir))?;
    let summary = index
        .conversations
        .iter_mut()
        .find(|summary| summary.id == conversation_id)
        .ok_or_else(|| "That Assistant Conversation no longer exists.".to_string())?;
    if summary.workspace_root != workspace_root {
        return Err("That Assistant Conversation belongs to a different Workspace.".into());
    }
    let path = record_path(app_data_dir, conversation_id);
    let mut record = load_record(&path)?;
    if record.workspace_root != workspace_root {
        return Err("That Assistant Conversation belongs to a different Workspace.".into());
    }
    mutate(&mut record)?;
    summary.updated_at = record.updated_at;
    summary.restore_status = record.restore_status;
    summary.name = record.name.clone();
    index.revision = next_revision(index.revision)?;
    write_record(&path, &record)?;
    write_index(&index_path(app_data_dir), &index)?;
    Ok(record)
}

fn upsert_prefs(
    index: &mut ConversationIndex,
    workspace_root: &str,
    last_agent_id: Option<String>,
    active_conversation_id: Option<String>,
) {
    if let Some(prefs) = index
        .workspace_prefs
        .iter_mut()
        .find(|prefs| prefs.workspace_root == workspace_root)
    {
        if let Some(agent_id) = last_agent_id {
            prefs.last_agent_id = Some(agent_id);
        }
        if let Some(conversation_id) = active_conversation_id {
            prefs.active_conversation_id = Some(conversation_id);
        }
        return;
    }
    index.workspace_prefs.push(WorkspaceAssistantPrefs {
        workspace_root: workspace_root.into(),
        last_agent_id,
        active_conversation_id,
    });
}

fn write_index(path: &Path, index: &ConversationIndex) -> Result<(), String> {
    validate_index(index)?;
    atomic_write(
        path,
        index,
        MAX_INDEX_FILE_BYTES,
        "Assistant Conversations index",
    )
}

fn write_record(path: &Path, record: &ConversationRecord) -> Result<(), String> {
    validate_record(record)?;
    // Ensure no ephemeral projection fields sneak into durable storage.
    assert_no_ephemeral_fields(record)?;
    atomic_write(
        path,
        record,
        MAX_RECORD_FILE_BYTES,
        "Assistant Conversation",
    )
}

fn assert_no_ephemeral_fields(record: &ConversationRecord) -> Result<(), String> {
    let raw = serde_json::to_value(record)
        .map_err(|error| format!("Assistant Conversation could not be validated: {error}"))?;
    for forbidden in [
        "thought",
        "thoughts",
        "reasoning",
        "hiddenReasoning",
        "terminalOutput",
        "toolResults",
        "intermediateToolResults",
        "streamChunks",
    ] {
        if contains_key(&raw, forbidden) {
            return Err(format!(
                "Assistant Conversation refused to persist ephemeral field `{forbidden}`."
            ));
        }
    }
    Ok(())
}

fn contains_key(value: &serde_json::Value, key: &str) -> bool {
    match value {
        serde_json::Value::Object(map) => {
            map.contains_key(key) || map.values().any(|child| contains_key(child, key))
        }
        serde_json::Value::Array(items) => items.iter().any(|child| contains_key(child, key)),
        _ => false,
    }
}

fn atomic_write<T: Serialize>(
    path: &Path,
    value: &T,
    max_bytes: u64,
    label: &str,
) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("{label} storage has no parent directory."))?;
    fs::create_dir_all(parent).map_err(|error| format!("{label} could not be saved: {error}"))?;
    let temp_path = temp_path_for(path);
    let payload = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("{label} could not be saved: {error}"))?;
    if payload.len() as u64 + 1 > max_bytes {
        return Err(format!("{label} exceeds the {max_bytes} bytes limit."));
    }
    let result = (|| -> Result<(), std::io::Error> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp_path)?;
        file.write_all(&payload)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        fs::rename(&temp_path, path)?;
        Ok(())
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("{label} could not be saved: {error}"));
    }
    #[cfg(unix)]
    let _ = File::open(parent).and_then(|directory| directory.sync_all());
    Ok(())
}

fn temp_path_for(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("assistant-conversation.json");
    path.with_file_name(format!(".{file_name}.{}.tmp", uuid::Uuid::new_v4()))
}

fn validate_index(index: &ConversationIndex) -> Result<(), String> {
    if index.version != CONVERSATION_INDEX_VERSION {
        return Err(format!(
            "Assistant Conversations index uses unsupported version {}.",
            index.version
        ));
    }
    if index.conversations.len() > MAX_CONVERSATIONS_TOTAL {
        return Err(format!(
            "Writer stores at most {MAX_CONVERSATIONS_TOTAL} Assistant Conversations."
        ));
    }
    let mut ids = std::collections::HashSet::with_capacity(index.conversations.len());
    let mut per_workspace = std::collections::HashMap::<&str, usize>::new();
    for summary in &index.conversations {
        validate_id(&summary.id, "conversation")?;
        validate_workspace_root(&summary.workspace_root)?;
        validate_agent_id(&summary.agent_id)?;
        if summary.name.is_empty() || summary.name.len() > MAX_NAME_BYTES {
            return Err(format!(
                "Assistant Conversation names must be 1 to {MAX_NAME_BYTES} bytes."
            ));
        }
        if !ids.insert(summary.id.as_str()) {
            return Err("Assistant Conversations index contains a duplicate id.".into());
        }
        *per_workspace
            .entry(summary.workspace_root.as_str())
            .or_default() += 1;
    }
    if per_workspace
        .values()
        .any(|count| *count > MAX_CONVERSATIONS_PER_WORKSPACE)
    {
        return Err(format!(
            "Writer stores at most {MAX_CONVERSATIONS_PER_WORKSPACE} Assistant Conversations per Workspace."
        ));
    }
    let mut prefs_roots = std::collections::HashSet::new();
    for prefs in &index.workspace_prefs {
        validate_workspace_root(&prefs.workspace_root)?;
        if !prefs_roots.insert(prefs.workspace_root.as_str()) {
            return Err("Assistant Conversations prefs contain a duplicate Workspace.".into());
        }
        if let Some(agent_id) = &prefs.last_agent_id {
            validate_agent_id(agent_id)?;
        }
        if let Some(conversation_id) = &prefs.active_conversation_id {
            validate_id(conversation_id, "conversation")?;
        }
    }
    Ok(())
}

fn validate_record(record: &ConversationRecord) -> Result<(), String> {
    if record.version != CONVERSATION_RECORD_VERSION {
        return Err(format!(
            "Assistant Conversation uses unsupported version {}.",
            record.version
        ));
    }
    validate_id(&record.id, "conversation")?;
    validate_workspace_root(&record.workspace_root)?;
    validate_agent_id(&record.agent_id)?;
    if record.name.is_empty() || record.name.len() > MAX_NAME_BYTES {
        return Err(format!(
            "Assistant Conversation names must be 1 to {MAX_NAME_BYTES} bytes."
        ));
    }
    if let Some(session_id) = &record.runtime_session_id {
        validate_session_id(session_id)?;
    }
    if record.messages.len() > MAX_MESSAGES_PER_CONVERSATION {
        return Err(format!(
            "Writer stores at most {MAX_MESSAGES_PER_CONVERSATION} messages per Conversation."
        ));
    }
    if record.turns.len() > MAX_TURNS_PER_CONVERSATION {
        return Err(format!(
            "Writer stores at most {MAX_TURNS_PER_CONVERSATION} turns per Conversation."
        ));
    }
    for message in &record.messages {
        validate_id(&message.id, "message")?;
        if message.content.len() > MAX_MESSAGE_BYTES {
            return Err(format!(
                "Conversation messages must be at most {MAX_MESSAGE_BYTES} bytes."
            ));
        }
        if message.citations.len() > MAX_CITATIONS_PER_MESSAGE {
            return Err(format!(
                "Writer stores at most {MAX_CITATIONS_PER_MESSAGE} citations per message."
            ));
        }
        for citation in &message.citations {
            if citation.path.is_empty() || citation.path.len() > MAX_CITATION_PATH_BYTES {
                return Err(format!(
                    "Citation paths must be 1 to {MAX_CITATION_PATH_BYTES} bytes."
                ));
            }
        }
    }
    for turn in &record.turns {
        validate_id(&turn.turn_id, "turn")?;
        if turn.change_summaries.len() > MAX_SUMMARIES_PER_TURN {
            return Err(format!(
                "Writer stores at most {MAX_SUMMARIES_PER_TURN} change summaries per turn."
            ));
        }
        if turn.permission_decisions.len() > MAX_PERMISSION_DECISIONS_PER_TURN {
            return Err(format!(
                "Writer stores at most {MAX_PERMISSION_DECISIONS_PER_TURN} permission decisions per turn."
            ));
        }
    }
    Ok(())
}

fn normalize_name(name: Option<String>, now: u64) -> Result<String, String> {
    let name = name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("Conversation {now}"));
    if name.len() > MAX_NAME_BYTES {
        return Err(format!(
            "Assistant Conversation names must be 1 to {MAX_NAME_BYTES} bytes."
        ));
    }
    Ok(name)
}

fn validate_prompt(prompt: &str) -> Result<(), String> {
    if prompt.trim().is_empty() || prompt.len() > MAX_MESSAGE_BYTES {
        return Err(format!(
            "Conversation user messages must contain 1 to {MAX_MESSAGE_BYTES} bytes."
        ));
    }
    Ok(())
}

fn validate_workspace_root(workspace_root: &str) -> Result<(), String> {
    if workspace_root.is_empty() || workspace_root.len() > MAX_WORKSPACE_PATH_BYTES {
        return Err(format!(
            "Assistant Conversation Workspace paths must be 1 to {MAX_WORKSPACE_PATH_BYTES} bytes."
        ));
    }
    if !Path::new(workspace_root).is_absolute() {
        return Err("Assistant Conversations require an absolute canonical Workspace path.".into());
    }
    Ok(())
}

fn validate_agent_id(agent_id: &str) -> Result<(), String> {
    validate_token(agent_id, "Agent", MAX_AGENT_ID_BYTES)
}

fn validate_session_id(session_id: &str) -> Result<(), String> {
    if session_id.is_empty() || session_id.len() > MAX_SESSION_ID_BYTES {
        return Err(format!(
            "Runtime session identifiers must be 1 to {MAX_SESSION_ID_BYTES} bytes."
        ));
    }
    Ok(())
}

fn validate_id(value: &str, label: &str) -> Result<(), String> {
    validate_token(value, label, MAX_ID_BYTES)
}

fn validate_token(value: &str, label: &str, max_bytes: usize) -> Result<(), String> {
    if value.is_empty()
        || value.len() > max_bytes
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(format!(
            "The {label} identity must be 1-{max_bytes} ASCII letters, digits, '.', '_' or '-'."
        ));
    }
    Ok(())
}

fn next_revision(revision: u64) -> Result<u64, String> {
    revision
        .checked_add(1)
        .ok_or_else(|| "Assistant Conversations revision reached its maximum.".to_string())
}

pub fn unix_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_select_rename_delete_round_trip_outside_the_workspace() {
        let app_data = tempfile::tempdir().unwrap();
        let workspace = "/Users/example/Notes";
        let foreign = "/Users/example/Other";

        let created = create_conversation(
            app_data.path(),
            workspace.into(),
            "claude-agent-acp".into(),
            Some("Drafting".into()),
        )
        .unwrap();
        assert_eq!(created.agent_id, "claude-agent-acp");
        assert_eq!(created.restore_status, ConversationRestoreStatus::None);
        assert!(created.runtime_session_id.is_none());
        assert!(created.messages.is_empty());

        // Storage must never land inside the Workspace directory.
        assert!(!Path::new(workspace).join(".writer").exists());
        assert!(index_path(app_data.path()).starts_with(app_data.path()));

        let listed = list_workspace_conversations(app_data.path(), workspace).unwrap();
        assert_eq!(listed.conversations.len(), 1);
        assert_eq!(
            listed.active_conversation_id.as_deref(),
            Some(created.id.as_str())
        );
        assert_eq!(listed.last_agent_id.as_deref(), Some("claude-agent-acp"));

        let foreign_list = list_workspace_conversations(app_data.path(), foreign).unwrap();
        assert!(foreign_list.conversations.is_empty());

        let renamed = rename_conversation(
            app_data.path(),
            workspace,
            &created.id,
            "Polish pass".into(),
        )
        .unwrap();
        assert_eq!(renamed.name, "Polish pass");

        let second =
            create_conversation(app_data.path(), workspace.into(), "codex-acp".into(), None)
                .unwrap();
        select_conversation(app_data.path(), workspace, &created.id).unwrap();
        let after_select = list_workspace_conversations(app_data.path(), workspace).unwrap();
        assert_eq!(
            after_select.active_conversation_id.as_deref(),
            Some(created.id.as_str())
        );

        let deleted = delete_conversation(app_data.path(), workspace, &created.id).unwrap();
        assert_eq!(deleted.conversations.len(), 1);
        assert_eq!(deleted.conversations[0].id, second.id);
        assert!(!record_path(app_data.path(), &created.id).exists());
        assert!(record_path(app_data.path(), &second.id).exists());
    }

    #[test]
    fn retained_turn_fields_persist_and_ephemeral_keys_are_rejected() {
        let app_data = tempfile::tempdir().unwrap();
        let workspace = "/tmp/writer-conversation-workspace";
        let created = create_conversation(
            app_data.path(),
            workspace.into(),
            "fake-agent".into(),
            Some("History".into()),
        )
        .unwrap();

        let finished = unix_millis();
        let record = append_completed_turn(
            app_data.path(),
            workspace,
            &created.id,
            TurnPersistenceInput {
                turn_id: "turn-1".into(),
                prompt: "Summarize the Workspace".into(),
                final_reply: "Here is the summary.".into(),
                status: "completed".into(),
                outcome_message: "Here is the summary.".into(),
                change_summaries: vec!["Updated note.md".into()],
                permission_decisions: vec![PersistedPermissionDecision {
                    request_id: "perm-1".into(),
                    title: "Access the network".into(),
                    option_id: Some("allow-once".into()),
                    decided_at: finished,
                }],
                runtime_session_id: Some("fake-session".into()),
                started_at: finished - 10,
                finished_at: finished,
            },
        )
        .unwrap();

        assert_eq!(record.messages.len(), 2);
        assert_eq!(record.messages[0].role, MessageRole::User);
        assert_eq!(record.messages[1].role, MessageRole::Assistant);
        assert_eq!(record.turns.len(), 1);
        assert_eq!(record.turns[0].change_summaries, ["Updated note.md"]);
        assert_eq!(
            record.turns[0].permission_decisions[0].option_id.as_deref(),
            Some("allow-once")
        );
        assert_eq!(record.runtime_session_id.as_deref(), Some("fake-session"));
        assert_eq!(record.restore_status, ConversationRestoreStatus::Active);

        let raw = fs::read_to_string(record_path(app_data.path(), &created.id)).unwrap();
        for forbidden in [
            "thought",
            "reasoning",
            "terminalOutput",
            "toolResults",
            "intermediateToolResults",
        ] {
            assert!(
                !raw.contains(forbidden),
                "persisted record unexpectedly contains `{forbidden}`"
            );
        }
        assert!(raw.contains("Here is the summary."));
        assert!(raw.contains("fake-session"));
        assert!(raw.contains("allow-once"));
    }

    #[test]
    fn restore_failure_preserves_transcript_and_blocks_further_turns() {
        let app_data = tempfile::tempdir().unwrap();
        let workspace = "/tmp/writer-restore-workspace";
        let created =
            create_conversation(app_data.path(), workspace.into(), "fake-agent".into(), None)
                .unwrap();
        let finished = unix_millis();
        append_completed_turn(
            app_data.path(),
            workspace,
            &created.id,
            TurnPersistenceInput {
                turn_id: "turn-1".into(),
                prompt: "First".into(),
                final_reply: "Reply".into(),
                status: "completed".into(),
                outcome_message: "Reply".into(),
                change_summaries: Vec::new(),
                permission_decisions: Vec::new(),
                runtime_session_id: Some("session-1".into()),
                started_at: finished,
                finished_at: finished,
            },
        )
        .unwrap();

        let failed = mark_session_restore_failed(app_data.path(), workspace, &created.id).unwrap();
        assert_eq!(failed.restore_status, ConversationRestoreStatus::Failed);
        assert_eq!(failed.messages.len(), 2);
        assert_eq!(failed.runtime_session_id.as_deref(), Some("session-1"));

        let error = append_completed_turn(
            app_data.path(),
            workspace,
            &created.id,
            TurnPersistenceInput {
                turn_id: "turn-2".into(),
                prompt: "Second".into(),
                final_reply: "Nope".into(),
                status: "completed".into(),
                outcome_message: "Nope".into(),
                change_summaries: Vec::new(),
                permission_decisions: Vec::new(),
                runtime_session_id: Some("session-2".into()),
                started_at: finished,
                finished_at: finished,
            },
        )
        .unwrap_err();
        assert!(error.contains("create a new Conversation"));
        let reloaded = load_record(&record_path(app_data.path(), &created.id)).unwrap();
        assert_eq!(reloaded.messages.len(), 2);
        assert_eq!(reloaded.runtime_session_id.as_deref(), Some("session-1"));
    }

    #[test]
    fn last_agent_preference_is_remembered_per_workspace() {
        let app_data = tempfile::tempdir().unwrap();
        let workspace_a = "/tmp/ws-a";
        let workspace_b = "/tmp/ws-b";
        remember_last_agent(app_data.path(), workspace_a, "agent-a").unwrap();
        remember_last_agent(app_data.path(), workspace_b, "agent-b").unwrap();
        remember_last_agent(app_data.path(), workspace_a, "agent-a2").unwrap();

        let a = list_workspace_conversations(app_data.path(), workspace_a).unwrap();
        let b = list_workspace_conversations(app_data.path(), workspace_b).unwrap();
        assert_eq!(a.last_agent_id.as_deref(), Some("agent-a2"));
        assert_eq!(b.last_agent_id.as_deref(), Some("agent-b"));
    }
}
