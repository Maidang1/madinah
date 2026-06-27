export const WRITER_COMMAND_EVENT = "writer-command";

export function getWriterCommandIdFromPayload(payload: unknown): string | null {
  return typeof payload === "string" && payload.length > 0 ? payload : null;
}
