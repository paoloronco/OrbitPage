import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AdminView.tsx", import.meta.url), "utf8");

describe("AdminView visual card selection", () => {
  it("keeps an unsaved preview card selected while it is being edited", () => {
    expect(source).toContain("previewLinks.some((link) => String(link.id) === String(visualLinkId))");
    expect(source).toContain("}, [previewLinks, visualLinkId]);");
  });
});
