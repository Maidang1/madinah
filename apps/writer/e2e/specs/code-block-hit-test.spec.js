import { ok } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HIT_TEST_META_PATH = join(
  homedir(),
  "Library/Application Support/com.maidang1.writer-computer.e2e/code-block-hit-test.json",
);

function readFixtureMeta() {
  return JSON.parse(readFileSync(HIT_TEST_META_PATH, "utf8"));
}

describe("Code block hit testing", function () {
  it("places CodeMirror activeLine on the clicked fenced-code line", async function () {
    const { targetText } = readFixtureMeta();

    await $(".cm-editor .cm-content").waitForExist({ timeout: 15_000 });
    await browser.waitUntil(
      async () =>
        browser.execute((text) => {
          return Array.from(document.querySelectorAll(".cm-fenced-code-line")).some((line) =>
            line.textContent?.includes(text),
          );
        }, targetText),
      {
        timeout: 15_000,
        timeoutMsg: `Expected fenced code line containing ${targetText}`,
      },
    );

    const before = await browser.execute((text) => {
      const lines = Array.from(document.querySelectorAll(".cm-fenced-code-line")).map(
        (line) => line.textContent ?? "",
      );
      return {
        lines,
        targetIndex: lines.findIndex((line) => line.includes(text)),
      };
    }, targetText);
    ok(before.targetIndex >= 0, "target fenced-code line should exist before clicking");

    const clickIndexes = [1, 2, before.targetIndex, before.lines.length - 2];

    for (const expectedIndex of clickIndexes) {
      await browser.execute((index) => {
        document.querySelectorAll("[data-e2e-code-hit-target]").forEach((line) => {
          line.removeAttribute("data-e2e-code-hit-target");
        });
        const target = document.querySelectorAll(".cm-fenced-code-line")[index];
        target?.setAttribute("data-e2e-code-hit-target", "true");
        target?.scrollIntoView({ block: "center", inline: "nearest" });
      }, expectedIndex);

      await $('[data-e2e-code-hit-target="true"]').waitForExist({ timeout: 5_000 });
      const clickPoint = await browser.execute(() => {
        const target = document.querySelector('[data-e2e-code-hit-target="true"]');
        if (!target) return null;
        const rect = target.getBoundingClientRect();
        return {
          x: Math.round(rect.left + 92),
          y: Math.round(rect.top + rect.height / 2),
        };
      });
      ok(clickPoint, "target fenced-code line should have a clickable rect");
      await browser.performActions([
        {
          type: "pointer",
          id: "mouse",
          parameters: { pointerType: "mouse" },
          actions: [
            {
              type: "pointerMove",
              duration: 0,
              origin: "viewport",
              x: clickPoint.x,
              y: clickPoint.y,
            },
            { type: "pointerDown", button: 0 },
            { type: "pointerUp", button: 0 },
          ],
        },
      ]);
      await browser.releaseActions();

      const activeInfo = await browser.execute((index) => {
        const fencedLines = Array.from(document.querySelectorAll(".cm-fenced-code-line"));
        const target = fencedLines[index];
        const selection = window.getSelection();
        const anchor =
          selection?.anchorNode instanceof Element
            ? selection.anchorNode
            : selection?.anchorNode?.parentElement;
        const selectedLine = anchor?.closest(".cm-fenced-code-line");
        const activeLine = document.querySelector(".cm-activeLine");
        const activeCodeLine = activeLine?.classList.contains("cm-fenced-code-line")
          ? activeLine
          : activeLine?.closest(".cm-fenced-code-line");

        if (!target || !selectedLine) {
          return {
            activeElement: {
              tag: document.activeElement?.tagName,
              className: document.activeElement?.className,
              contenteditable: document.activeElement?.getAttribute("contenteditable"),
            },
            anchorText: selection?.anchorNode?.textContent,
            anchorOffset: selection?.anchorOffset,
            selectedIndex: -1,
            activeIndex: activeCodeLine ? fencedLines.indexOf(activeCodeLine) : -1,
            activeText: activeCodeLine?.textContent,
            targetIndex: target ? index : -1,
            targetText: target?.textContent,
          };
        }

        const targetRect = target.getBoundingClientRect();
        const selectedRect = selectedLine.getBoundingClientRect();
        return {
          activeElement: {
            tag: document.activeElement?.tagName,
            className: document.activeElement?.className,
            contenteditable: document.activeElement?.getAttribute("contenteditable"),
          },
          anchorText: selection?.anchorNode?.textContent,
          anchorOffset: selection?.anchorOffset,
          selectedIndex: fencedLines.indexOf(selectedLine),
          selectedText: selectedLine.textContent,
          activeIndex: activeCodeLine ? fencedLines.indexOf(activeCodeLine) : -1,
          activeText: activeCodeLine?.textContent,
          targetIndex: index,
          target: {
            text: target.textContent,
            top: targetRect.top,
            bottom: targetRect.bottom,
            height: targetRect.height,
          },
          selected: {
            top: selectedRect.top,
            height: selectedRect.height,
          },
          deltaY: Math.abs(
            selectedRect.top + selectedRect.height / 2 - (targetRect.top + targetRect.height / 2),
          ),
        };
      }, expectedIndex);

      ok(
        activeInfo.activeIndex === activeInfo.targetIndex,
        `activeLine should land on clicked line: ${JSON.stringify({
          expectedIndex,
          clickPoint,
          activeInfo,
        })}`,
      );
    }
  });
});
