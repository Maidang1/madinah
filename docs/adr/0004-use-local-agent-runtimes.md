# Use local agent runtimes

Writer conducts Assistant Conversations by invoking user-managed AI agents installed on the user's computer rather than integrating model-provider APIs directly. Initial compatibility targets Claude and Codex through ACP adapters; Grok and other agents join through compatible ACP servers. This avoids making Writer the owner of provider credentials and API billing, at the cost of depending on external runtime installation and behavior.
