import { describe, expect, test } from "vite-plus/test";

import { MENU_EVENT_HANDLERS } from "../src/hooks/use-menu-events";

describe("menu-events", () => {
  test("has no preferences menu handler after settings UI removal", () => {
    expect(MENU_EVENT_HANDLERS["menu:open-preferences"]).toBeUndefined();
    expect(Object.keys(MENU_EVENT_HANDLERS)).toEqual([]);
  });
});
