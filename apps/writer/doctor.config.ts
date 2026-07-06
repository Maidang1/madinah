// React Doctor configuration — https://react.doctor/docs/configuration/config-files
//
// Writer is a local-first Tauri v2 desktop app (the whole frontend ships in one
// bundle and talks to a Rust backend over local IPC). A few React Doctor rules
// assume a web/SSR + network context and systematically misfire on that
// architecture, so they are turned off here. Everything else stays on; genuine
// per-site exceptions are handled with narrow inline `eslint-disable-next-line
// react-doctor/<rule>` comments at the call site, not global config.
export default {
  rules: {
    // Heavy-library / code-splitting rule. The flagged imports are CodeMirror
    // and @lezer extensions composed *synchronously* into the editor's
    // EditorState — they are not React components, so React.lazy/dynamic import
    // does not apply, and a desktop app loads its one local bundle up front
    // anyway (no network bundle to defer). Lazy-loading the editor engine of an
    // editor would only add a Suspense flash on startup.
    "react-doctor/prefer-dynamic-import": "off",

    // The async-parallelism rules optimize for network round-trip latency. In
    // this app the awaits are local Tauri IPC / filesystem reads that are
    // *deliberately* sequenced: cancellation-token re-entrancy checks
    // (reveal-in-sidebar), animation-frame pacing, first-match priority probing
    // (path resolution), drain-until-empty queues, and write-then-refresh
    // ordering. Parallelizing them would change behavior, not speed up a page.
    // (Where parallelizing was genuinely safe, the code already uses
    // Promise.all — these rules stay off only because every remaining hit is an
    // intentional sequence.)
    "react-doctor/async-await-in-loop": "off",
    "react-doctor/async-defer-await": "off",
    "react-doctor/async-parallel": "off",
  },
};
