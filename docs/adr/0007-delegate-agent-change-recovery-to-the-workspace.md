# Delegate agent change recovery to the Workspace

Writer does not provide transactional rollback for changes made by an unrestricted Agent Runtime. The Assistant Conversation shows the runtime's reported change summary, while recovery relies on the Workspace's own Git history or backups; Writer discloses this limitation when obtaining AI Access Consent rather than copying the complete Workspace before every Agent Turn.
