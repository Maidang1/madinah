import type { ComponentType, ReactNode } from "react";

/**
 * Session-serialized location payload. The `kind` tag plus a free-form bag of
 * fields. Session files carry this shape; an unknown `kind` (written by a
 * newer client) round-trips unchanged but fails to deserialize back into a
 * live `Location`.
 */
export interface SerializedLocation {
  kind: string;
  [key: string]: unknown;
}

/**
 * Input shape for `definePageKind`. Only `kind` and `title` are required —
 * everything else has a sensible default (see `definePageKind` below). Kinds
 * with payload (like `file`) override as many as they need; stateless kinds
 * (like `launcher`, `settings`) usually only set `keepAlive`.
 *
 * This describes a kind's *behavior* only — its React view lives separately in
 * the `pageKindViews` registry (`./views`) so the data/serialization layer
 * (stores, hooks) never transitively imports the editor UI tree.
 */
export interface PageKindInput<K extends string, L extends { kind: K }> {
  /** Discriminator string used as the map key and in the session `kind` field. */
  kind: K;
  /** Fallback tab title — beaten by a document-driven title where one exists. */
  title: (location: L) => string;
  /** Short human-readable description of this page kind — surfaced in the
   *  command palette and other places that want a subtitle for the kind. */
  description: string;

  /** Stays mounted when inactive? Default: `false`. */
  keepAlive?: boolean;
  /** Whether file-only context-menu items appear on this tab. Default: `false`. */
  supportsFileContextMenu?: boolean;
  /** Reconstruct a live location from a serialized payload. Default:
   *  `{ kind }` — which fits stateless kinds. Override when the kind carries
   *  payload (e.g. a file path). Return `null` for invalid data. */
  fromPayload?: (data: SerializedLocation) => L | null;
  /** All filesystem paths this location references. Default: `[]`. */
  paths?: (location: L) => string[];
  /** The primary path for APIs that need a single one. Default: `null`. */
  primaryPath?: (location: L) => string | null;
  /** Apply a rename/move. Default: identity. Return `null` to invalidate. */
  rewritePath?: (location: L, from: string, to: string) => L | null;
  /** Apply a delete. Default: identity. Return `null` to invalidate. */
  removePath?: (location: L, path: string) => L | null;
  /** Session payload (excluding the `kind` tag). Default: `{}`. Return `null`
   *  to skip persistence (transient kinds like launcher). */
  serialize?: (location: L) => object | null;
}

/** A registered page kind — what you actually dispatch through at runtime
 *  after `definePageKind` has filled in the defaults. All methods are
 *  required here, so call sites never need to null-check. Behavior only — the
 *  React view is held separately in `PageKindView` / the `pageKindViews`
 *  registry so stores and hooks can dispatch through this without importing the
 *  editor UI. */
export interface PageKind<K extends string = string, L extends { kind: K } = { kind: K }> {
  kind: K;
  title: (location: L) => string;
  description: string;
  keepAlive: boolean;
  supportsFileContextMenu: boolean;
  fromPayload: (data: SerializedLocation) => L | null;
  paths: (location: L) => string[];
  primaryPath: (location: L) => string | null;
  rewritePath: (location: L, from: string, to: string) => L | null;
  removePath: (location: L, path: string) => L | null;
  serialize: (location: L) => object | null;
}

/** Widest `PageKind` type — used by the registry map where the specific kind
 *  isn't statically known. */
export type AnyPageKind = PageKind<string, { kind: string }>;

/** The React view for a page kind — its tab body and optional footer chrome.
 *  Kept out of `PageKind` so the editor UI is only imported by the renderer
 *  (`pageKindViews` in `./views`), never by the data/serialization layer. */
export interface PageKindView<L extends { kind: string } = { kind: string }> {
  /** React renderer for the tab body. */
  Component: ComponentType<{ location: L; isActive: boolean }>;
  /** Optional chrome rendered below the active tab body. */
  renderFooter?: (location: L) => ReactNode;
}

/**
 * Assemble a `PageKind` from a sparse input by filling in defaults. This is
 * the one place where the defaults live — each kind module just specifies
 * what's unique to it.
 */
export function definePageKind<K extends string, L extends { kind: K }>(
  input: PageKindInput<K, L>,
): PageKind<K, L> {
  return {
    keepAlive: false,
    supportsFileContextMenu: false,
    fromPayload: () => ({ kind: input.kind }) as L,
    paths: () => [],
    primaryPath: () => null,
    rewritePath: (l) => l,
    removePath: (l) => l,
    serialize: () => ({}),
    ...input,
  };
}
