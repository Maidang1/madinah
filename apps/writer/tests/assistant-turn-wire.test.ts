import { describe, expect, test } from "vite-plus/test";
import fixture from "../shared/assistant-turn-wire.json";
import type {
  AgentTurnEvent,
  AgentTurnPhase,
  TurnBridgeRegistration,
} from "../src/platform/tauri/assistant";

function oneOf<T extends string>(value: string, allowed: readonly T[]): T {
  expect(allowed).toContain(value);
  return value as T;
}

describe("Assistant Turn serialized wire contract", () => {
  test("the shared raw fixture reconstructs through the TypeScript mirror", () => {
    const bridge: TurnBridgeRegistration = fixture.bridgeRegistration;
    const events: AgentTurnEvent[] = fixture.events.map((event) => {
      const common = {
        turnId: event.turnId,
        conversationId: event.conversationId,
        workspaceRoot: event.workspaceRoot,
      };
      switch (event.type) {
        case "prepare":
          return {
            ...common,
            type: "prepare",
            workspaceEpoch: event.workspaceEpoch!,
            participantToken: event.participantToken!,
            bridgeId: event.bridgeId!,
            requestId: event.requestId!,
          };
        case "reconcile":
          return {
            ...common,
            type: "reconcile",
            workspaceEpoch: event.workspaceEpoch!,
            participantToken: event.participantToken!,
            bridgeId: event.bridgeId!,
            requestId: event.requestId!,
            lease: event.lease!,
          };
        case "phase":
          return {
            ...common,
            type: "phase",
            phase: oneOf<AgentTurnPhase>(event.phase!, [
              "preparing",
              "running",
              "awaiting-permission",
              "reconciling",
            ]),
          };
        case "permission":
          return {
            ...common,
            type: "permission",
            requestId: event.requestId!,
            title: event.title!,
            options: event.options!,
          };
        case "stream-text":
          return { ...common, type: "stream-text", text: event.text! };
        case "change-summary":
          return { ...common, type: "change-summary", summary: event.summary! };
        case "reconciliation-blocked":
          return {
            ...common,
            type: "reconciliation-blocked",
            message: event.message!,
          };
        case "terminal":
          return {
            ...common,
            type: "terminal",
            status: oneOf(event.status!, ["completed", "failed"] as const),
            message: event.message!,
          };
        default:
          throw new Error(`Unknown fixture event: ${event.type}`);
      }
    });

    expect(bridge).toEqual(fixture.bridgeRegistration);
    expect(events).toEqual(fixture.events);
  });
});
