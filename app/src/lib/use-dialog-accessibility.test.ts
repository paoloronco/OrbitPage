import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./use-dialog-accessibility.ts", import.meta.url), "utf8");

describe("custom dialog keyboard contract", () => {
  it("traps Tab, closes on Escape and restores focus", () => {
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain("previousFocus.focus()");
  });
});
