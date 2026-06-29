import type { PluginDiagnostic, WorkspaceInfo } from "../../domain/engine";

export const PLUGIN_DIAGNOSTICS_PANEL_ID = "workspace-plugin-diagnostics";

interface PluginDiagnosticsProps {
  workspace: WorkspaceInfo | null;
  diagnostics: PluginDiagnostic[];
}

export function PluginDiagnostics({
  workspace,
  diagnostics,
}: PluginDiagnosticsProps) {
  const status = getPluginDiagnosticsStatus(workspace, diagnostics);

  return (
    <section
      id={PLUGIN_DIAGNOSTICS_PANEL_ID}
      className="inspector-section plugin-diagnostics"
      aria-label="Workspace plugin diagnostics"
    >
      <div className="inspector-section-header">
        <span>Workspace Extensions</span>
        <small>{status}</small>
      </div>
      {workspace ? (
        <div className="plugin-diagnostics-workspace" title={workspace.root}>
          {workspace.root}
        </div>
      ) : null}
      {!workspace ? (
        <p className="plugin-diagnostics-empty">
          Open a workspace file to inspect extensions.
        </p>
      ) : diagnostics.length === 0 ? (
        <p className="plugin-diagnostics-healthy">
          Workspace extensions healthy
        </p>
      ) : (
        <ul className="plugin-diagnostics-list">
          {diagnostics.map((diagnostic, index) => (
            <li
              key={`${diagnostic.pluginId}:${diagnostic.severity}:${index}`}
              className={`plugin-diagnostic-row is-${diagnostic.severity}`}
            >
              <span className="plugin-diagnostic-severity">
                {diagnostic.severity}
              </span>
              <strong>{diagnostic.pluginId}</strong>
              <p>{diagnostic.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getPluginDiagnosticsStatus(
  workspace: WorkspaceInfo | null,
  diagnostics: PluginDiagnostic[],
): string {
  if (!workspace) return "No workspace";
  if (diagnostics.length === 0) return "Healthy";
  return `${diagnostics.length} ${diagnostics.length === 1 ? "issue" : "issues"}`;
}
