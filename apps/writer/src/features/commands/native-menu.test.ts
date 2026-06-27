import { describe, expect, it } from "vitest";
import {
  WRITER_COMMAND_EVENT,
  getWriterCommandIdFromPayload,
} from "./native-menu";

describe("native menu command events", () => {
  it("extracts command ids from Tauri menu event payloads", () => {
    expect(WRITER_COMMAND_EVENT).toBe("writer-command");
    expect(getWriterCommandIdFromPayload("document.save")).toBe("document.save");
    expect(getWriterCommandIdFromPayload("")).toBeNull();
    expect(getWriterCommandIdFromPayload({ commandId: "document.save" })).toBeNull();
  });
});
