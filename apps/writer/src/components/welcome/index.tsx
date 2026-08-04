import { useWorkspace } from "@/hooks/use-workspace";
import { openFile as openFileFromApi } from "@/hooks/editor-api";
import * as tauri from "@/lib/tauri";
import { getParentDir } from "@/lib/paths";

export function WelcomeScreen() {
  const { openWorkspace } = useWorkspace();

  async function handleAddLocation() {
    const picked = await tauri.pickWorkspace();
    if (picked) {
      await openWorkspace(picked);
    }
  }

  async function handleOpenFile() {
    const picked = await tauri.pickFile();
    if (!picked) return;
    const dir = getParentDir(picked);
    await openWorkspace(dir);
    await openFileFromApi(picked);
  }

  return (
    <main className="flex h-screen items-center justify-center px-6 text-text-primary">
      <section
        aria-labelledby="welcome-title"
        className="w-full max-w-[420px] rounded-2xl border border-[var(--line-subtler)] bg-[var(--surface-chrome-raised)] px-8 py-9 text-center shadow-[var(--chrome-shadow)]"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--surface-subtle)] text-[17px] font-semibold text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--line-subtler)]"
        >
          M
        </div>
        <h1 id="welcome-title" className="text-[21px] font-semibold tracking-[-0.02em]">
          Open your writing workspace
        </h1>
        <p className="mx-auto mt-2.5 max-w-[34ch] text-[14px] leading-relaxed text-text-muted text-pretty">
          Choose a folder for your specs, docs, notes, and Markdown or MDX files.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void handleAddLocation()}
            className="flex min-h-10 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-[13px] font-medium text-[var(--surface-primary)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.96]"
          >
            Add Folder
          </button>
          <button
            type="button"
            onClick={() => void handleOpenFile()}
            className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line-subtle)] px-5 text-[13px] font-medium text-[var(--text-secondary)] transition-[background-color,transform] hover:bg-[var(--surface-subtle)] active:scale-[0.96]"
          >
            Open File
          </button>
        </div>
      </section>
    </main>
  );
}
