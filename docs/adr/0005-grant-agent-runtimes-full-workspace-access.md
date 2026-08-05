# Grant agent runtimes full Workspace access

Writer launches an Agent Runtime with unrestricted read and write access to the complete Workspace. The runtime may inspect excluded or non-document files and may modify files without a Writer-owned diff approval step, favoring full agent capability over isolation, least-privilege access, and pre-apply review; this supersedes ADR-0001.
