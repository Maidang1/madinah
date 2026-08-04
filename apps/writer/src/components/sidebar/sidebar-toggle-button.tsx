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
      className="group flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-base)] transition-[background-color,transform] hover:bg-[var(--surface-subtle)] active:scale-[0.96]"
    >
      <span className="opacity-60 transition-opacity group-hover:opacity-100 group-hover:transition-none">
        <HugeiconsIcon icon={SidebarLeftIcon} size={18} color="currentColor" strokeWidth={2} />
      </span>
    </button>
  );
}
