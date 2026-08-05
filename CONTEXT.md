# Writer

Writer is an AI-first environment for reading, writing, and querying local Markdown and MDX documents while keeping the document as its primary work surface.

## Language

**Document**:
A Markdown or MDX file that Writer can open, edit, and validate as evidence for a Grounded Answer.
_Avoid_: Note, page, text file

**Workspace**:
The local directory tree a user opens and manages as a unit. It is the complete default boundary that an Agent Runtime may read and modify, without a separate enrollment step.
_Avoid_: Knowledge base, corpus, library

**Assistant Conversation**:
A persistent exchange belonging to one Workspace and one Agent Runtime in which a user asks AI to explain, translate, polish, or change content. A Workspace may contain multiple conversations, and changing the active document does not change the active conversation; changing the runtime requires a new conversation. Conversations remain local to the Writer installation rather than traveling with the Workspace.
_Avoid_: Chatbot session, prompt history

**Focus Context**:
The active document and text selection supplied to an Agent Runtime for an Agent Turn. It supplements the conversation's access to the complete Workspace.
_Avoid_: Prompt context, attached file

**Quick Action**:
A preset intent submitted through the active Assistant Conversation with the current Focus Context. Translate and explain answer in the conversation without changing files; polish may modify the selected content, and translation modifies it only when the user explicitly asks for replacement.
_Avoid_: AI tool, workflow, command

**Grounded Answer**:
An answer supported only by Documents in the current Workspace, with navigable references that return the user to the supporting passages. Missing evidence is reported rather than filled with outside knowledge.
_Avoid_: AI answer, search result, summary

**Ungrounded Answer**:
Agent output that lacks any valid Workspace reference. Writer may display it with an explicit warning, but never presents it as a Grounded Answer.
_Avoid_: Failed answer, hallucination

**AI Access Consent**:
The user's persistent permission for Writer and an Agent Runtime to access and modify one complete Workspace and send its content to cloud AI services without Writer-provided rollback. Consent is obtained once for each Workspace when AI is first enabled there, rather than before every request or once for the entire application.
_Avoid_: Per-request confirmation, privacy notice

**Agent Runtime**:
A user-managed AI agent that Writer invokes to conduct Assistant Conversations. It has unrestricted read and write access inside the Workspace, while operations affecting the surrounding computer or external systems remain subject to user approval.
_Avoid_: Local model, AI provider, embedded model

**External Action**:
An Agent Runtime operation that executes a terminal command, causes an external network side effect, or accesses a path outside the Workspace. Each External Action requires explicit user approval.
_Avoid_: Tool call, permission, dangerous action

**Agent Turn**:
The sole active interval in a Workspace from submitting a message to an Agent Runtime until Writer has incorporated the runtime's changes. User editing and other Agent Turns pause in every Writer window for that Workspace; stopping a turn preserves changes already written and marks the turn as interrupted.
_Avoid_: Request, generation, background task
