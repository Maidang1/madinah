export const MIN_EDITOR_WIDTH = 360;
export const MIN_LEFT_PANE_WIDTH = 220;
export const MAX_LEFT_PANE_WIDTH = 420;
export const MIN_RIGHT_PANE_WIDTH = 280;
export const MAX_RIGHT_PANE_WIDTH = 480;

interface PaneWidthRequest {
  containerWidth: number;
  leftVisible: boolean;
  leftWidth: number;
  rightVisible: boolean;
  rightWidth: number;
  preferredPane?: "left" | "right";
}

export interface ResolvedPaneWidths {
  left: number;
  editor: number;
  right: number;
}

export function resolvePaneWidths(request: PaneWidthRequest): ResolvedPaneWidths {
  const container = Math.max(0, Math.round(request.containerWidth));
  const paneBudget = Math.max(0, container - MIN_EDITOR_WIDTH);
  let left = request.leftVisible
    ? clamp(request.leftWidth, MIN_LEFT_PANE_WIDTH, MAX_LEFT_PANE_WIDTH)
    : 0;
  let right = request.rightVisible
    ? clamp(request.rightWidth, MIN_RIGHT_PANE_WIDTH, MAX_RIGHT_PANE_WIDTH)
    : 0;

  if (request.preferredPane === "left") {
    left = Math.max(0, Math.min(left, paneBudget - right));
    if (left + right > paneBudget) right = Math.max(0, paneBudget - left);
  } else if (request.preferredPane === "right") {
    right = Math.max(0, Math.min(right, paneBudget - left));
    if (left + right > paneBudget) left = Math.max(0, paneBudget - right);
  } else if (left + right > paneBudget) {
    let overflow = left + right - paneBudget;
    const rightReduction = Math.min(overflow, Math.max(0, right - MIN_RIGHT_PANE_WIDTH));
    right -= rightReduction;
    overflow -= rightReduction;
    const leftReduction = Math.min(overflow, Math.max(0, left - MIN_LEFT_PANE_WIDTH));
    left -= leftReduction;
    overflow -= leftReduction;
    if (overflow > 0) {
      const extraRightReduction = Math.min(overflow, right);
      right -= extraRightReduction;
      overflow -= extraRightReduction;
    }
    if (overflow > 0) left = Math.max(0, left - overflow);
  }

  return {
    left,
    editor: Math.max(0, container - left - right),
    right,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}
