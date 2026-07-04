import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createDefaultAssetUploadSettings } from "../../domain/assets";
import { createDefaultAcpSettings } from "../ai-polish/settings";
import { WriterSettingsDialog } from "./WriterSettingsDialog";

describe("WriterSettingsDialog", () => {
  it("renders markdown profile inside editor settings", () => {
    const html = renderToStaticMarkup(
      <WriterSettingsDialog
        {...createSettingsDialogProps()}
      />,
    );

    expect(html).toContain("Editor");
    expect(html).toContain('class="writer-settings-sidebar"');
    expect(html).toContain('class="writer-settings-main"');
    expect(html).toContain("Markdown Profile");
    expect(html).toContain("GitHub Flavored Markdown");
    expect(html).toContain('class="writer-settings-select"');
  });
});

function createSettingsDialogProps() {
  return {
    isOpen: true,
    aiAvailable: true,
    assetUploadAvailable: true,
    workspacePluginsAvailable: true,
    profiles: [
      { id: "gfm", name: "GitHub Flavored Markdown" },
      { id: "mdx", name: "MDX" },
    ],
    profileId: "gfm",
    workspace: null,
    workspacePlugins: [],
    pluginDiagnostics: [],
    acpSettings: createDefaultAcpSettings(),
    assetSettings: createDefaultAssetUploadSettings(),
    acpCheckState: { status: "idle" as const, message: "Ready" },
    assetCheckState: { status: "idle" as const, message: "Ready" },
    workspacePluginCheckState: { status: "idle" as const, message: "Ready" },
    onClose: vi.fn(),
    onSaveProfile: vi.fn(),
    onSaveAcp: vi.fn(),
    onCheckAcp: vi.fn(),
    onSaveAssets: vi.fn(),
    onCheckAssets: vi.fn(),
    onRefreshWorkspacePlugins: vi.fn(),
    onSetWorkspacePluginTrust: vi.fn(),
  };
}
