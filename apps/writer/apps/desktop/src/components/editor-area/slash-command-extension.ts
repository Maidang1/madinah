import { Prec, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type PluginValue, type ViewUpdate } from "@codemirror/view";
import { getEditorCommandsForSurface } from "./editor-commands";
import {
  createSlashCommandItems,
  getSlashCommandPosition,
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

const MENU_SIZE = { width: 280, height: 340 };

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
        this.items = searchSlashCommandItems(slashItems, trigger.query);
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
        this.menu.setAttribute("role", "listbox");
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
        if (this.items.length === 0) {
          const empty = document.createElement("div");
          empty.className = "slash-command-empty";
          empty.textContent = this.trigger.query
            ? `No command for /${this.trigger.query}`
            : "No commands";
          this.menu.appendChild(empty);
          return;
        }

        this.items.forEach((item, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("role", "option");
          button.setAttribute("aria-selected", String(index === this.selectedIndex));
          if (index === this.selectedIndex) button.classList.add("is-selected");
          button.addEventListener("mousedown", (event) => {
            event.preventDefault();
            void this.run(item);
          });

          const text = document.createElement("span");
          const label = document.createElement("strong");
          label.textContent = item.label;
          const detail = document.createElement("small");
          detail.textContent = item.group;
          text.append(label, detail);
          button.appendChild(text);

          if (item.shortcut) {
            const shortcut = document.createElement("kbd");
            shortcut.textContent = item.shortcut.replace("Mod", "⌘");
            button.appendChild(shortcut);
          }

          this.menu!.appendChild(button);
        });
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
