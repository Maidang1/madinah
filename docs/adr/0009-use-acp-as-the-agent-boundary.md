# Use ACP as the agent boundary

Writer acts as an [Agent Client Protocol](https://agentclientprotocol.com/) client and communicates only with locally launched ACP-compatible Agent Runtimes, using protocol negotiation and advertised capabilities instead of provider-specific CLI interfaces. Claude and Codex can initially connect through registered ACP adapters, while Grok support depends on an ACP-compatible server becoming available; this favors a stable multi-agent boundary over direct access to every runtime-specific feature.
