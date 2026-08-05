# Ground knowledge answers in the Workspace

Writer instructs Agent Runtimes to answer knowledge questions only from Markdown and MDX Documents in the current Workspace using relative-path and heading references, then validates that each reference resolves to a supporting location. The runtime may read other Workspace files as context, but they do not count as valid evidence; output without a valid source remains visible but is marked Ungrounded.
