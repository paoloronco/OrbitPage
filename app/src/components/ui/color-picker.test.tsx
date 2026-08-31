import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ColorPicker } from "./color-picker";
import { normalizeHexColor } from "./color-picker-utils";

describe("ColorPicker", () => {
  it("renders a controlled HEX trigger with an accessible dialog relationship", () => {
    const html = renderToStaticMarkup(
      <ColorPicker label="Accent" onChange={() => undefined} value="#AbC123" />,
    );

    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Accent: #ABC123"');
    expect(html).toContain("#ABC123");
    expect(html).not.toContain('type="color"');
  });

  it("normalizes shorthand values and keeps disabled controls unavailable", () => {
    expect(normalizeHexColor("abc", "#000000")).toBe("#aabbcc");
    expect(normalizeHexColor("invalid", "#123456")).toBe("#123456");

    const html = renderToStaticMarkup(
      <ColorPicker disabled label="Background" onChange={() => undefined} value="#ffffff" />,
    );
    expect(html).toContain("disabled");
  });

  it("replaces native dashboard color inputs with the shared picker", () => {
    const componentPaths = [
      "../ThemeCustomizer.tsx",
      "../BackgroundMediaCustomizer.tsx",
      "../ProfileSection.tsx",
      "../MenuEditor.tsx",
      "../ProfileQrCode.tsx",
      "../TextCard.tsx",
      "../LinkCard.tsx",
    ];
    for (const componentPath of componentPaths) {
      const source = readFileSync(new URL(componentPath, import.meta.url), "utf8");
      expect(source).toContain("ColorPicker");
      expect(source).not.toMatch(/type=["']color["']/);
    }
  });
});
