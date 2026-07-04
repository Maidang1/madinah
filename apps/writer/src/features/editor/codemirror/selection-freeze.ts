import {
  StateEffect,
  StateField,
  Transaction,
  type EditorState,
  type Extension,
  type SelectionRange,
} from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

const startSelectionFreeze = StateEffect.define<readonly SelectionRange[]>();
const endSelectionFreeze = StateEffect.define<null>();

const frozenSelectionField = StateField.define<readonly SelectionRange[] | null>(
  {
    create() {
      return null;
    },
    update(value, transaction) {
      for (const effect of transaction.effects) {
        if (effect.is(startSelectionFreeze)) return effect.value;
        if (effect.is(endSelectionFreeze)) return null;
      }

      if (value && transaction.docChanged) {
        return value.map((range) => range.map(transaction.changes));
      }

      return value;
    },
  },
);

function isPrimaryPointerDrag(event: PointerEvent): boolean {
  return event.isPrimary && event.button === 0;
}

function shouldStartSelectionFreeze(view: EditorView, event: PointerEvent) {
  if (!isPrimaryPointerDrag(event)) return false;
  if (view.state.field(frozenSelectionField, false) !== null) return false;
  return true;
}

const selectionFreezePlugin = ViewPlugin.fromClass(
  class {
    private readonly onContentPointerDown: (event: PointerEvent) => void;
    private readonly onWindowPointerUp: () => void;
    private readonly onWindowPointerCancel: () => void;
    private readonly onContentBlur: () => void;

    constructor(private readonly view: EditorView) {
      this.onContentPointerDown = (event) => {
        if (!shouldStartSelectionFreeze(this.view, event)) return;
        this.view.dispatch({
          effects: startSelectionFreeze.of(this.view.state.selection.ranges),
        });
      };
      this.onWindowPointerUp = () => this.endSelectionFreeze();
      this.onWindowPointerCancel = () => this.endSelectionFreeze();
      this.onContentBlur = () => this.endSelectionFreeze();

      this.view.contentDOM.addEventListener(
        "pointerdown",
        this.onContentPointerDown,
      );
      this.view.contentDOM.addEventListener("blur", this.onContentBlur);
      window.addEventListener("pointerup", this.onWindowPointerUp);
      window.addEventListener("pointercancel", this.onWindowPointerCancel);
    }

    private endSelectionFreeze() {
      if (this.view.state.field(frozenSelectionField, false) === null) return;
      this.view.dispatch({
        selection: this.view.state.selection,
        effects: endSelectionFreeze.of(null),
        annotations: Transaction.userEvent.of("select.pointer.drag-end"),
      });
    }

    destroy() {
      this.view.contentDOM.removeEventListener(
        "pointerdown",
        this.onContentPointerDown,
      );
      this.view.contentDOM.removeEventListener("blur", this.onContentBlur);
      window.removeEventListener("pointerup", this.onWindowPointerUp);
      window.removeEventListener("pointercancel", this.onWindowPointerCancel);
    }
  },
);

export function getEffectiveSelectionRanges(
  state: EditorState,
): readonly SelectionRange[] {
  return state.field(frozenSelectionField, false) ?? state.selection.ranges;
}

export function isSelectionDecorationFrozen(state: EditorState) {
  return state.field(frozenSelectionField, false) !== null;
}

export function selectionFreezeExtension(enabled: boolean): Extension {
  return enabled ? [frozenSelectionField, selectionFreezePlugin] : [];
}
