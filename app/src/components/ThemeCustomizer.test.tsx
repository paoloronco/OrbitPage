import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isOrbitPageThemePresetConfiguration, parseOrbitPageTheme } from "@orbitpage/page-schema";
import { cardThemePresets } from "@/lib/card-theme-presets";
import { defaultTheme } from "@/lib/theme";
import { themePresets } from "@/lib/theme-presets";
import { buildCardPresetTheme, buildPagePresetTheme } from "./ThemeCustomizer";

describe("ThemeCustomizer preset saves", () => {
  it("keeps the theme headings concise and moves page-theme guidance into a tooltip", () => {
    const source = readFileSync(new URL("./ThemeCustomizer.tsx", import.meta.url), "utf8");

    expect(source).toContain('tr("Page background", "Sfondo pagina")');
    expect(source).toContain('tr("Card background & colors", "Sfondo e colori delle card")');
    expect(source).toContain("<TooltipContent");
    expect(source).not.toContain("6 Mono + 6 Multi");
    expect(source).not.toContain('tr("Manual controls"');
  });

  it("turns a grandfathered custom theme into valid Starter presets", () => {
    const customTheme = {
      ...defaultTheme,
      background: "#eceef1",
      contentCard: { ...defaultTheme.contentCard, background: "#ffffff" },
      contentCardVariants: [{ ...defaultTheme.contentCard, background: "#ffffff" }],
      orbitPageAccess: { mode: "custom" as const, presetId: null, cardPresetId: null },
    };

    const cardTheme = buildCardPresetTheme(customTheme, cardThemePresets[1], "premium");
    const pageTheme = buildPagePresetTheme(customTheme, themePresets[4], "premium");

    expect(isOrbitPageThemePresetConfiguration(parseOrbitPageTheme(cardTheme), "premium")).toBe(true);
    expect(isOrbitPageThemePresetConfiguration(parseOrbitPageTheme(pageTheme), "premium")).toBe(true);
  });
});
