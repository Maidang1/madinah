# Serialize user and agent writes

Each Workspace permits at most one Agent Turn at a time and does not queue additional turns. Before a turn, Writer saves every open document, disables other conversation sends, and makes every Writer window for that Workspace read-only; after the runtime finishes, Writer rescans the Workspace and reloads its results in all affected windows before editing resumes. This prevents user and agent writes—or two agents—from racing, accepting a Workspace-wide interruption in exchange for deterministic file ownership.
