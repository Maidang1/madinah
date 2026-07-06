import { useCallback, useRef, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  useFrontmatterEntries,
  type FrontmatterEntryUpdateOptions,
} from "./use-frontmatter-entries";
import {
  formatFrontmatterControlValue,
  getFrontmatterFieldDefinition,
  getSelectOptionsWithCurrentValue,
  parseFrontmatterControlValue,
} from "@/lib/frontmatter-schema";
import type { YamlEntry } from "@/lib/yaml-entries";

interface FrontmatterPanelProps {
  filePath: string;
  variant?: "body" | "inspector";
}

// Stable module-scope ref callback. A stable ref runs only on mount/unmount
// (never per-render), so this focuses the key input exactly once when a
// placeholder row mounts — matching the previous `autoFocus` behavior without
// the disruptive attribute.
function focusOnMount(el: HTMLInputElement | null) {
  el?.focus();
}

interface FrontmatterRowProps {
  entry: YamlEntry;
  index: number;
  onUpdate: (
    index: number,
    field: "key" | "value",
    value: string,
    options?: FrontmatterEntryUpdateOptions,
  ) => void;
  onRemove: (index: number) => void;
  onBlur: (index: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>, index: number, field: "key" | "value") => void;
  variant: "body" | "inspector";
}

function FrontmatterRow({
  entry,
  index,
  onUpdate,
  onRemove,
  onBlur,
  onKeyDown,
  variant,
}: FrontmatterRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const definition = getFrontmatterFieldDefinition(entry.key);
  const controlValue = formatFrontmatterControlValue(entry);

  // Focus the key input only for placeholder rows — i.e. a seeded empty row on
  // fresh panel mount, or a new row appended via Add Property. The stable
  // `focusOnMount` ref runs only on input mount; committed rows pass no focusing
  // ref and never steal focus on re-renders.
  const isPlaceholder = entry.key === "" && entry.value === "";

  // Blurs that move focus to another field in the same row (Tab from key to
  // value) should not trigger blur-cleanup. Filter those out via relatedTarget.
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && rowRef.current?.contains(next)) return;
      onBlur(index);
    },
    [index, onBlur],
  );

  const handleValueChange = useCallback(
    (value: string) => {
      const next = parseFrontmatterControlValue(entry.key, value);
      onUpdate(index, "value", next.value, { isComplex: next.isComplex });
    },
    [entry.key, index, onUpdate],
  );

  const valueClassName =
    variant === "inspector"
      ? "min-w-0 flex-1 bg-transparent text-[13px] leading-[1.25] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] placeholder:opacity-70"
      : "min-w-0 flex-1 bg-transparent text-[13px] leading-[1.15] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] placeholder:opacity-70";
  const inputValueClassName = `${valueClassName} h-7`;

  let valueControl: ReactNode;
  switch (definition.control.kind) {
    case "select": {
      const options = getSelectOptionsWithCurrentValue(definition.control.options, entry.value);
      valueControl = (
        <select
          data-field="value"
          aria-label="Property value"
          value={entry.value}
          onChange={(e) => handleValueChange(e.target.value)}
          onBlur={handleBlur}
          className={`${inputValueClassName} appearance-none bg-[image:var(--select-chevron)] bg-[length:12px_12px] bg-[position:right_0_center] bg-no-repeat pr-5 font-[inherit]`}
        >
          {entry.value === "" ? <option value="">Select status</option> : null}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "textarea":
      valueControl = (
        <textarea
          data-field="value"
          aria-label="Property value"
          value={entry.value}
          onChange={(e) => handleValueChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="value"
          spellCheck={false}
          rows={variant === "inspector" ? 3 : 2}
          className={`${valueClassName} min-h-14 resize-none py-1`}
        />
      );
      break;
    case "datetime":
      valueControl = (
        <input
          data-field="value"
          type="datetime-local"
          aria-label="Property value"
          value={controlValue}
          step={1}
          onChange={(e) => handleValueChange(e.target.value)}
          onKeyDown={(e) => onKeyDown(e, index, "value")}
          onBlur={handleBlur}
          className={`${inputValueClassName} font-[inherit]`}
        />
      );
      break;
    case "tags":
      valueControl = (
        <input
          data-field="value"
          type="text"
          aria-label="Property value"
          value={controlValue}
          onChange={(e) => handleValueChange(e.target.value)}
          onKeyDown={(e) => onKeyDown(e, index, "value")}
          onBlur={handleBlur}
          placeholder="tag-a, tag-b"
          spellCheck={false}
          className={inputValueClassName}
        />
      );
      break;
    case "text":
    default:
      valueControl = (
        <input
          data-field="value"
          type="text"
          aria-label="Property value"
          value={entry.value}
          onChange={(e) => handleValueChange(e.target.value)}
          onKeyDown={(e) => onKeyDown(e, index, "value")}
          onBlur={handleBlur}
          placeholder="value"
          spellCheck={false}
          className={inputValueClassName}
        />
      );
  }

  return (
    <div
      ref={rowRef}
      className={
        variant === "inspector"
          ? "group -mx-2 flex min-h-8 items-center gap-3 rounded-md px-2 py-1.5 focus-within:bg-[var(--surface-subtle)]"
          : "group -mx-3 flex items-center gap-4 rounded-lg px-3 py-1.5 focus-within:bg-[var(--surface-subtle)]"
      }
    >
      <input
        data-field="key"
        type="text"
        aria-label="Property name"
        value={entry.key}
        onChange={(e) => onUpdate(index, "key", e.target.value)}
        onKeyDown={(e) => onKeyDown(e, index, "key")}
        onBlur={handleBlur}
        ref={isPlaceholder ? focusOnMount : undefined}
        placeholder="key"
        spellCheck={false}
        className={
          variant === "inspector"
            ? "w-[104px] shrink-0 bg-transparent text-[13px] leading-[1.25] text-[var(--text-muted)] outline-none placeholder:text-[var(--text-muted)] placeholder:opacity-70"
            : "w-36 shrink-0 bg-transparent text-[13px] leading-[1.15] text-[var(--text-muted)] outline-none placeholder:text-[var(--text-muted)] placeholder:opacity-70"
        }
      />

      {valueControl}

      <button
        type="button"
        onClick={() => onRemove(index)}
        aria-label="Remove property"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--text-icon-muted)] opacity-0 transition-opacity hover:text-[var(--text-primary)] group-hover:opacity-100"
        tabIndex={-1}
      >
        <HugeiconsIcon icon={Cancel01Icon} size={11} color="currentColor" strokeWidth={2} />
      </button>
    </div>
  );
}

export function FrontmatterPanel({ filePath, variant = "body" }: FrontmatterPanelProps) {
  const {
    entries,
    updateEntry,
    removeEntry,
    addEntry,
    createFrontmatter,
    blurEntry,
    hasFrontmatter,
  } = useFrontmatterEntries(filePath);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, index: number, field: "key" | "value") => {
      if (e.key === "Enter" && field === "value" && index === entries.length - 1) {
        e.preventDefault();
        addEntry();
        // focusOnMount on the newly-mounted empty row handles focus — no RAF needed.
        return;
      }
      if (e.key === "Backspace" && entries[index]?.key === "" && entries[index]?.value === "") {
        e.preventDefault();
        removeEntry(index);
      }
    },
    [entries, addEntry, removeEntry],
  );

  if (!hasFrontmatter) {
    if (variant !== "inspector") return null;
    return (
      <div ref={containerRef} data-frontmatter className="space-y-3">
        <p className="text-[13px] leading-5 text-[var(--text-muted)]">
          This document has no properties.
        </p>
        <button
          type="button"
          onClick={createFrontmatter}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] leading-none text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
        >
          <HugeiconsIcon icon={Add01Icon} size={14} color="currentColor" strokeWidth={2} />
          Add property
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-frontmatter
      className={variant === "inspector" ? "space-y-2" : "space-y-2 pb-6"}
    >
      <div className="flex flex-col gap-1.5">
        {entries.map((entry, index) => (
          <FrontmatterRow
            key={entry.id}
            entry={entry}
            index={index}
            onUpdate={updateEntry}
            onRemove={removeEntry}
            onBlur={blurEntry}
            onKeyDown={handleKeyDown}
            variant={variant}
          />
        ))}
      </div>

      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={addEntry}
          className={
            variant === "inspector"
              ? "flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] leading-none text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
              : "flex items-center gap-1 text-[13px] leading-[1.15] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          }
        >
          <HugeiconsIcon icon={Add01Icon} size={14} color="currentColor" strokeWidth={2} />
          Add property
        </button>
      </div>
    </div>
  );
}
