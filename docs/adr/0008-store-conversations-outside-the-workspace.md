# Store conversations outside the Workspace

Writer stores Assistant Conversation history and external runtime session identifiers in its local application data rather than writing metadata into the Workspace. Deleting a conversation removes only Writer-owned data and mappings, not session data retained by the user-managed Agent Runtime; this keeps Workspaces clean but means conversations neither follow them to another computer nor provide cross-runtime deletion guarantees.

Writer persists user messages, final agent replies, citations, change summaries, permission decisions, runtime session identifiers, turn states, and timestamps. Streaming thoughts, hidden reasoning, full terminal output, and intermediate tool results remain ephemeral to the active turn.
