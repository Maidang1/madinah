# Delegate knowledge retrieval to the agent

Writer v1 does not build embeddings, a vector database, or a separate retrieval index for AI. The Agent Runtime searches and reads the live Workspace directly when producing Grounded Answers, favoring a single local source of truth and smaller initial scope while accepting weaker guarantees for semantic recall in very large Workspaces.
