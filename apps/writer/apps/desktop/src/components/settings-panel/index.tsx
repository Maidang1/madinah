import { useMemo } from "react";
import { useAllSettings, useResetSetting, useSetSetting } from "@/hooks/use-settings";
import { SETTINGS_SCHEMA, type SettingDef } from "@/lib/settings-schema";
import { SettingControl } from "./setting-control";
import { ThemesSection } from "./themes-section";
import { EditorScrollContainer } from "@/components/editor-area/editor-scroll-container";
import { AssetUploadSection } from "./asset-upload-section";
import { AiSettingsSection } from "./ai-settings-section";

/** Section that renders above the Themes block. The schema-driven section
 *  list is rendered in two passes — these come first, the Themes section
 *  comes next, and everything else is rendered after. */
const SECTIONS_BEFORE_THEMES = ["Appearance"] as const;

export function SettingsPanel({ isActive }: { isActive: boolean }) {
  const settings = useAllSettings();
  const setSetting = useSetSetting();
  const resetSetting = useResetSetting();

  const categories = useMemo(() => {
    const map = new Map<string, SettingDef[]>();
    for (const def of SETTINGS_SCHEMA) {
      // Theme settings are owned by ThemesSection; keep them out of the generic renderer.
      if (def.category === "Theme") continue;
      const existing = map.get(def.category) ?? [];
      existing.push(def);
      map.set(def.category, existing);
    }
    return map;
  }, []);

  function isModified(def: SettingDef): boolean {
    return JSON.stringify(settings[def.key]) !== JSON.stringify(def.default);
  }

  function renderSection(category: string, defs: SettingDef[]) {
    return (
      <section key={category} className="mb-10">
        <h2 className="mb-3 text-[13px] font-medium text-[var(--text-muted)]">{category}</h2>
        <div className="-mx-4 overflow-hidden rounded-2xl border border-[var(--line-subtler)] bg-[var(--surface-card)]">
          {defs.map((def, i) => (
            <div
              key={def.key}
              className={i === 0 ? undefined : "border-t border-[var(--line-subtler)]"}
            >
              <SettingControl
                def={def}
                value={settings[def.key]}
                onChange={(value) => void setSetting(def.key, value)}
                onReset={() => void resetSetting(def.key)}
                isModified={isModified(def)}
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const beforeThemes: [string, SettingDef[]][] = [];
  for (const cat of SECTIONS_BEFORE_THEMES) {
    const defs = categories.get(cat);
    if (defs) beforeThemes.push([cat, defs]);
  }

  const beforeThemesSet = new Set<string>(SECTIONS_BEFORE_THEMES);
  const afterThemes = Array.from(categories.entries()).filter(([cat]) => !beforeThemesSet.has(cat));

  return (
    <div
      data-settings-panel
      className={
        isActive ? "relative z-10 h-full" : "absolute inset-0 invisible pointer-events-none h-full"
      }
      aria-hidden={!isActive}
    >
      <EditorScrollContainer>
        <div className="mx-auto max-w-2xl px-8 pt-32 pb-24 md:pt-[9rem]">
          <h1 className="mb-10 text-2xl font-semibold text-[var(--text-primary)]">Preferences</h1>

          {beforeThemes.map(([cat, defs]) => renderSection(cat, defs))}

          <ThemesSection />

          <AssetUploadSection isActive={isActive} />

          <AiSettingsSection isActive={isActive} />

          {afterThemes.map(([cat, defs]) => renderSection(cat, defs))}
        </div>
      </EditorScrollContainer>
    </div>
  );
}
