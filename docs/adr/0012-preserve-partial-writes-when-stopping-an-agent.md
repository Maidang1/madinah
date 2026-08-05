# Preserve partial writes when stopping an agent

Writer always lets the user stop an Agent Turn, first requesting ACP cancellation and then terminating an unresponsive runtime after a grace period. It preserves any files already changed, marks the turn as interrupted, rescans the Workspace, and restores editing without attempting rollback, consistent with Writer's non-transactional recovery boundary.
