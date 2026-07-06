import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarLeftIcon } from "@hugeicons/core-free-icons";
import { useSidebar } from "@/hooks/use-sidebar";

export function SidebarToggleButton() {
  const { isSidebarVisible, toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
      title={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
      className="group flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-base)] transition-colors hover:bg-[var(--surface-subtle)] hover:transition-none"
    >
      <span className="opacity-60 transition-opacity group-hover:opacity-100 group-hover:transition-none">
        <HugeiconsIcon icon={SidebarLeftIcon} size={18} color="currentColor" strokeWidth={2} />
      </span>
    </button>
  );
}
