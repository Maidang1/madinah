import { useEffect, useState, type FormEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, Trash2, X } from "lucide-react";
import {
  activeEditor$,
  cancelLinkEdit$,
  editorRootElementRef$,
  linkDialogState$,
  onWindowChange$,
  removeLink$,
  showLinkTitleField$,
  updateLink$,
  usePublisher,
} from "@mdxeditor/editor";
import { useCellValues } from "@mdxeditor/gurx";

/**
 * Custom replacement for MDXEditor's built-in LinkDialog, injected via
 * `linkDialogPlugin({ LinkDialog: WriterLinkDialog })`.
 *
 * Two deliberate differences from the stock component:
 *  1. The "preview" popover (shown when the caret merely lands on a link) is
 *     suppressed entirely — we render nothing for it. Links are only touched
 *     when the user explicitly asks to edit (selection toolbar link button /
 *     Cmd+K), which puts the dialog into "edit" state.
 *  2. The "edit" form is our own markup styled with the app's `.writer-link-dialog`
 *     classes, so it matches the other floating surfaces and adapts to the theme
 *     — no overrides of MDXEditor's internal CSS.
 */
export function WriterLinkDialog() {
  const [linkDialogState, editorRootElementRef, showLinkTitleField, activeEditor] =
    useCellValues(
      linkDialogState$,
      editorRootElementRef$,
      showLinkTitleField$,
      activeEditor$,
    );

  const publishWindowChange = usePublisher(onWindowChange$);
  const updateLink = usePublisher(updateLink$);
  const cancelLinkEdit = usePublisher(cancelLinkEdit$);
  const removeLink = usePublisher(removeLink$);

  // Keep the anchor rectangle in sync while the dialog is open, so the popover
  // tracks the selection during window resize / scroll (mirrors the stock one).
  useEffect(() => {
    const update = () => {
      activeEditor?.getEditorState().read(() => {
        publishWindowChange(true);
      });
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [activeEditor, publishWindowChange]);

  // Suppress the preview popover and the inactive state; only render for edit.
  // Return an empty fragment (not null) so the type matches MDXEditor's
  // `LinkDialog` option, which is typed as a component returning an Element.
  if (linkDialogState.type !== "edit") return <></>;

  const { rectangle } = linkDialogState;

  return (
    <Popover.Root open>
      <Popover.Anchor
        className="writer-link-dialog-anchor"
        style={{
          position: "absolute",
          top: `${rectangle.top}px`,
          left: `${rectangle.left}px`,
          width: `${rectangle.width}px`,
          height: `${rectangle.height}px`,
        }}
      />
      <Popover.Portal container={editorRootElementRef?.current}>
        <Popover.Content
          className="writer-link-dialog"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          key={linkDialogState.linkNodeKey}
        >
          <LinkEditForm
            initialUrl={linkDialogState.url}
            initialTitle={linkDialogState.title}
            initialText={linkDialogState.text}
            showAnchorTextField={linkDialogState.withAnchorText}
            showTitleField={showLinkTitleField}
            onSubmit={(values) => updateLink(values)}
            onCancel={() => cancelLinkEdit()}
            onRemove={
              linkDialogState.initialUrl ? () => removeLink() : undefined
            }
          />
          <Popover.Arrow className="writer-link-dialog-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function LinkEditForm({
  initialUrl,
  initialTitle,
  initialText,
  showAnchorTextField,
  showTitleField,
  onSubmit,
  onCancel,
  onRemove,
}: {
  initialUrl: string;
  initialTitle: string;
  initialText: string;
  showAnchorTextField: boolean;
  showTitleField: boolean;
  onSubmit: (values: {
    url: string;
    title: string | undefined;
    text: string | undefined;
  }) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSubmit({
      url,
      title: showTitleField ? title : undefined,
      text: showAnchorTextField ? text : undefined,
    });
  };

  return (
    <form
      className="writer-link-dialog-form"
      onSubmit={handleSubmit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <label className="writer-link-dialog-field">
        <span>链接地址</span>
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={url}
          onChange={(event) => setUrl(event.currentTarget.value)}
          placeholder="粘贴或输入 URL"
          spellCheck={false}
          aria-label="链接地址"
        />
      </label>

      {showAnchorTextField ? (
        <label className="writer-link-dialog-field">
          <span>显示文字</span>
          <input
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            placeholder="链接显示的文字"
            aria-label="显示文字"
          />
        </label>
      ) : null}

      {showTitleField ? (
        <label className="writer-link-dialog-field">
          <span>标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="悬停时显示的标题"
            aria-label="链接标题"
          />
        </label>
      ) : null}

      <div className="writer-link-dialog-actions">
        {onRemove ? (
          <button
            type="button"
            className="writer-link-dialog-button is-danger"
            onClick={onRemove}
            title="移除链接"
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>移除</span>
          </button>
        ) : null}
        <div className="writer-link-dialog-actions-primary">
          <button
            type="button"
            className="writer-link-dialog-button"
            onClick={onCancel}
            title="取消 (Esc)"
          >
            <X size={14} aria-hidden="true" />
            <span>取消</span>
          </button>
          <button
            type="submit"
            className="writer-link-dialog-button is-primary"
            title="保存 (Enter)"
          >
            <Check size={14} aria-hidden="true" />
            <span>保存</span>
          </button>
        </div>
      </div>
    </form>
  );
}
