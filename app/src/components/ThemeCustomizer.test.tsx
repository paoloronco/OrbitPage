import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isOrbitPageThemePresetConfiguration, parseOrbitPageTheme } from "@orbitpage/page-schema";
import { cardThemePresets } from "@/lib/card-theme-presets";
import { defaultTheme } from "@/lib/theme";
import { themePresets } from "@/lib/theme-presets";
import { buildCardPresetTheme, buildPagePresetTheme } from "./theme-save-state";

describe("ThemeCustomizer preset saves", () => {
  it("keeps the theme headings concise and moves page-theme guidance into a tooltip", () => {
    const source = readFileSync(new URL("./ThemeCustomizer.tsx", import.meta.url), "utf8");
    const tooltipSource = readFileSync(new URL("./ui/tooltip.tsx", import.meta.url), "utf8");

    expect(source).toContain('tr("Page background", "Sfondo pagina")');
    expect(source).toContain('tr("Card background & colors", "Sfondo e colori delle card")');
    expect(source).toContain("<TooltipContent");
    expect(source).toContain('tr("Buttons & highlights", "Pulsanti ed elementi in evidenza")');
    expect(source).toContain('tr("Content card background", "Sfondo card contenuto")');
    expect(source).toContain('aria-label={`${label}: ${description}`}');
    expect(tooltipSource).toContain("<TooltipPrimitive.Portal>");
    expect(source).toContain('label={tr("Name and surname", "Nome e cognome")}');
    expect(source).toContain('label={tr("Card titles", "Titoli delle card")}');
    expect(source).toContain('label="URL"');
    expect(source).not.toContain("Page typeface");
    expect(source).not.toContain("Applied to profile, cards, labels and calls to action.");
    expect(source).not.toContain("6 Mono + 6 Multi");
    expect(source).not.toContain('tr("Manual controls"');
    expect(source).not.toContain('tr("Custom theme"');
    expect(source).not.toContain("admin-theme-preview-summary-colors");
    expect(source).not.toContain('tr("Active theme colors"');
    expect(source).not.toContain("This is the same renderer used by the public page.");
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
