import { Prec, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type PluginValue, type ViewUpdate } from "@codemirror/view";
import { getEditorCommandsForSurface } from "./editor-commands";
import {
  createSlashCommandItems,
  getSlashCommandPosition,
  groupSlashCommandItems,
  matchSlashCommandTriggerText,
  searchSlashCommandItems,
  type SlashCommandItem,
} from "./slash-commands";

interface ActiveSlashTrigger {
  from: number;
  to: number;
  query: string;
  atLineStart: boolean;
}

const MENU_SIZE = { width: 330, height: 390 };

export function slashCommandExtension(getFilePath: () => string): Extension {
  const slashPlugin = ViewPlugin.fromClass(
    class implements PluginValue {
      private menu: HTMLDivElement | null = null;
      private trigger: ActiveSlashTrigger | null = null;
      private items: SlashCommandItem[] = [];
      private selectedIndex = 0;
      private renderFrame: number | null = null;

      constructor(private readonly view: EditorView) {
        this.refresh();
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          this.refresh();
        }
      }

      destroy() {
        this.close();
      }

      closeMenu() {
        this.close();
      }

      handleKeydown(event: KeyboardEvent): boolean {
        if (!this.trigger || !this.menu) return false;

        if (event.key === "Escape") {
          event.preventDefault();
          this.close();
          return true;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.selectedIndex =
            this.items.length === 0 ? 0 : (this.selectedIndex + 1) % this.items.length;
          this.render();
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          this.selectedIndex =
            this.items.length === 0
              ? 0
              : (this.selectedIndex - 1 + this.items.length) % this.items.length;
          this.render();
          return true;
        }

        if (event.key === "Home") {
          event.preventDefault();
          this.selectedIndex = 0;
          this.render();
          return true;
        }

        if (event.key === "End") {
          event.preventDefault();
          this.selectedIndex = Math.max(0, this.items.length - 1);
          this.render();
          return true;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          const item = this.items[this.selectedIndex];
          if (!item) return false;
          event.preventDefault();
          void this.run(item);
          return true;
        }

        return false;
      }

      private refresh() {
        const trigger = activeSlashTrigger(this.view);
        if (!trigger || !this.view.hasFocus) {
          this.close();
          return;
        }

        const queryChanged =
          !this.trigger ||
          this.trigger.query !== trigger.query ||
          this.trigger.from !== trigger.from ||
          this.trigger.to !== trigger.to;
        this.trigger = trigger;
        const slashItems = createSlashCommandItems(getEditorCommandsForSurface("slash"));
        const matchingItems = searchSlashCommandItems(slashItems, trigger.query);
        this.items = groupSlashCommandItems(matchingItems).flatMap((group) => group.items);
        this.selectedIndex = queryChanged
          ? 0
          : Math.min(this.selectedIndex, Math.max(0, this.items.length - 1));
        this.ensureMenu();
        this.scheduleRender();
      }

      private ensureMenu() {
        if (this.menu) return;
        this.menu = document.createElement("div");
        this.menu.className = "slash-command-menu";
        this.menu.setAttribute("role", "dialog");
        this.menu.setAttribute("aria-label", "Insert block or run command");
        document.body.appendChild(this.menu);
      }

      private close() {
        if (this.renderFrame !== null) {
          cancelAnimationFrame(this.renderFrame);
          this.renderFrame = null;
        }
        this.trigger = null;
        this.items = [];
        this.selectedIndex = 0;
        this.menu?.remove();
        this.menu = null;
      }

      private scheduleRender() {
        if (this.renderFrame !== null) return;
        this.renderFrame = requestAnimationFrame(() => {
          this.renderFrame = null;
          this.render();
        });
      }

      private render() {
        if (!this.menu || !this.trigger) return;

        const caret = getSlashAnchorRect(this.view, this.trigger.to);
        if (!caret) {
          this.close();
          return;
        }
        const position = getSlashCommandPosition(caret, MENU_SIZE, {
          width: window.innerWidth,
          height: window.innerHeight,
        });
        this.menu.style.left = `${position.x}px`;
        this.menu.style.top = `${position.y}px`;

        this.menu.replaceChildren();

        const results = document.createElement("div");
        results.className = "slash-command-results";
        results.setAttribute("role", "listbox");
        results.setAttribute("aria-label", "Commands");
        if (this.items.length === 0) {
          const empty = document.createElement("div");
          empty.className = "slash-command-empty";
          empty.textContent = this.trigger.query
            ? `No command for /${this.trigger.query}`
            : "No commands";
          results.appendChild(empty);
          this.menu.append(results, createSlashCommandFooter());
          return;
        }

        let itemIndex = 0;
        for (const group of groupSlashCommandItems(this.items)) {
          const section = document.createElement("section");
          section.className = "slash-command-section";
          section.setAttribute("role", "group");

          const heading = document.createElement("div");
          const headingId = `slash-command-section-${group.section.replace(/[^a-z0-9_-]/gi, "-")}`;
          heading.id = headingId;
          heading.className = "slash-command-section-heading";
          heading.textContent = group.section;
          section.setAttribute("aria-labelledby", headingId);
          section.appendChild(heading);

          for (const item of group.items) {
            const index = itemIndex++;
            const button = document.createElement("button");
            const optionId = `slash-command-${item.id.replace(/[^a-z0-9_-]/gi, "-")}`;
            button.id = optionId;
            button.type = "button";
            button.setAttribute("role", "option");
            button.setAttribute("aria-selected", String(index === this.selectedIndex));
            if (index === this.selectedIndex) {
              button.classList.add("is-selected");
              results.setAttribute("aria-activedescendant", optionId);
            }
            button.addEventListener("mousedown", (event) => {
              event.preventDefault();
              void this.run(item);
            });

            const icon = document.createElement("span");
            icon.className = "slash-command-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = item.icon;

            const text = document.createElement("span");
            text.className = "slash-command-text";
            const label = document.createElement("strong");
            label.textContent = item.label;
            const detail = document.createElement("small");
            detail.textContent = item.description;
            text.append(label, detail);
            button.append(icon, text);

            if (item.shortcut) {
              const shortcut = document.createElement("kbd");
              shortcut.textContent = item.shortcut.replace("Mod", "⌘");
              button.appendChild(shortcut);
            }

            section.appendChild(button);
          }

          results.appendChild(section);
        }
        this.menu.append(results, createSlashCommandFooter());
        scrollSelectedSlashItem(this.menu);
      }

      private async run(item: SlashCommandItem) {
        const trigger = this.trigger;
        if (!trigger) return;
        this.close();
        this.view.dispatch({
          changes: { from: trigger.from, to: trigger.to, insert: "" },
          selection: { anchor: trigger.from },
          userEvent: "input.slashCommand",
        });
        await item.command.run(this.view, getFilePath());
      }
    },
  );

  return [
    slashPlugin,
    Prec.highest(
      EditorView.domEventHandlers({
        keydown(event, view) {
          return view.plugin(slashPlugin)?.handleKeydown(event) ?? false;
        },
        blur(_event, view) {
          requestAnimationFrame(() => {
            if (!view.hasFocus) view.plugin(slashPlugin)?.closeMenu();
          });
          return false;
        },
      }),
    ),
  ];
}

function getSlashAnchorRect(
  view: EditorView,
  pos: number,
): { left: number; top: number; bottom: number } | null {
  const coords = view.coordsAtPos(pos);
  if (coords) return coords;

  const line = view.state.doc.lineAt(pos);
  const lineStart = view.coordsAtPos(line.from);
  const block = view.lineBlockAt(pos);
  const editorRect = view.dom.getBoundingClientRect();
  const top = view.documentTop + block.top;
  const bottom = view.documentTop + block.bottom;
  const fallbackLeft = lineStart?.left ?? editorRect.left;

  return {
    left: fallbackLeft,
    top,
    bottom,
  };
}

export const __testSlashCommandExtension = {
  getSlashAnchorRect,
  scrollSelectedSlashItem,
};

function scrollSelectedSlashItem(menu: HTMLElement): void {
  const selected = menu.querySelector<HTMLButtonElement>("button.is-selected");
  selected?.scrollIntoView({ block: "nearest" });
}

function createSlashCommandFooter(): HTMLDivElement {
  const footer = document.createElement("div");
  footer.className = "slash-command-footer";
  footer.append(
    createKeyboardHint("↑↓", "Navigate"),
    createKeyboardHint("↵", "Select"),
    createKeyboardHint("Esc", "Close"),
  );
  return footer;
}

function createKeyboardHint(key: string, label: string): HTMLSpanElement {
  const hint = document.createElement("span");
  const keyboard = document.createElement("kbd");
  keyboard.textContent = key;
  hint.append(keyboard, ` ${label}`);
  return hint;
}

function activeSlashTrigger(view: EditorView): ActiveSlashTrigger | null {
  const selection = view.state.selection.main;
  if (!selection.empty) return null;

  const line = view.state.doc.lineAt(selection.head);
  const textBeforeCaret = view.state.sliceDoc(line.from, selection.head);
  const match = matchSlashCommandTriggerText(textBeforeCaret);
  if (!match) return null;

  return {
    from: line.from + match.slashOffset,
    to: selection.head,
    query: match.query,
    atLineStart: match.atLineStart,
  };
}
