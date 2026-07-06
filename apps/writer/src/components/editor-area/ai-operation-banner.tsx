import { clearAiOperation, useAiOperationStore } from "./ai-operation-store";

export function AiOperationBanner() {
  const operation = useAiOperationStore((state) => state.operation);
  if (operation.status === "idle") return null;

  return (
    <button
      type="button"
      onClick={operation.status === "running" ? undefined : clearAiOperation}
      className="pointer-events-auto absolute left-1/2 top-16 z-30 max-w-[90%] -translate-x-1/2 cursor-pointer rounded-lg border px-3 py-2 text-left text-[13px]"
      style={{
        background: "var(--surface-card)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderColor: "var(--line-subtler)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
        color: "var(--text-secondary)",
      }}
    >
      <span className="block font-medium text-[var(--text-primary)]">{operation.label}</span>
      {operation.detail && (
        <span className="mt-0.5 block max-w-[520px] truncate text-[12px] text-[var(--text-muted)]">
          {operation.detail}
        </span>
      )}
    </button>
  );
}
