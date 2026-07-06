import { useOpenCommandPalette } from "@/hooks/use-command-palette";

function Shortcut({ children }: { children: string }) {
  return (
    <kbd className="text-[11px] tracking-[0.2em] text-[var(--text-icon-muted)]">{children}</kbd>
  );
}

export function NewTabPage() {
  const openCommandPalette = useOpenCommandPalette();

  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => openCommandPalette("create-file")}
          className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          Create new note
          <Shortcut>⌘N</Shortcut>
        </button>

        <button
          type="button"
          onClick={() => openCommandPalette("search")}
          className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          Search
          <Shortcut>⌘O</Shortcut>
        </button>
      </div>
    </div>
  );
}
