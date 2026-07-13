# Madinah One-click Publish

## Problem

Writer and the Astro site share the article data contract, while the final publication step still requires manual frontmatter edits, Git commands, and finding the live URL. The Web article page also lacks a direct sharing action.

## Goal

Turn the current local-first workflow into a safe one-click publication path and give both surfaces a shared article identity.

## Requirements

- `@madinah/content-core` owns the canonical site URL, live article URL, publication metadata preparation, and publication validation.
- Publishing accepts only Markdown or MDX files inside `src/blogs`.
- Writer discovers the Git repository root from the open workspace, including when `src/blogs` itself is the workspace root.
- Publishing requires a non-empty title and body plus valid YAML frontmatter.
- The action sets `status: published` and fills `pubDate` when absent.
- Writer flushes the active file through the existing save engine before invoking Git.
- Git stages and commits only the active article path, preserving unrelated staged and unstaged changes.
- Git pushes the current branch to its configured upstream and returns the commit, branch, and live URL.
- Re-publishing an unchanged article is idempotent and returns an unchanged result.
- The Writer surface exposes Publish/Publish update and View online actions with visible running, success, and error feedback.
- The Astro article page exposes a Share action with clipboard fallback.

## Failure Semantics

- Invalid metadata blocks the action before disk or Git mutation.
- Missing repository, detached HEAD, missing upstream, and Git failures surface explicit messages.
- A push failure reports that the commit exists locally, so retry behavior is understandable.

## Validation

- Shared contract unit tests cover preparation, validation, paths, and URLs.
- Writer tests cover save flushing and publish UI/API contracts.
- Rust tests cover repository/path validation and isolated publication in a temporary bare-remote setup.
- `vp check`, `vp test`, `cargo test`, `cargo clippy`, and the Astro production build pass.
