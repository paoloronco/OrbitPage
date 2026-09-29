import { describe, expect, it } from "vitest";
import { APP_LOCALES, normalizeAppLocale, resolveApplicationErrorLocale, resolveInitialAppLocale } from "./i18n";

describe("editor i18n", () => {
  it("supports the same locale families as the managed site", () => {
    expect(APP_LOCALES).toEqual(["en", "it", "es", "fr", "de", "pt", "nl", "pl", "tr", "ru", "ar", "zh", "ja", "ko"]);
    expect(normalizeAppLocale("es-MX")).toBe("es");
    expect(normalizeAppLocale("zh-Hant")).toBe("zh");
    expect(normalizeAppLocale("ko-KR")).toBe("ko");
    expect(normalizeAppLocale("sv-SE")).toBeNull();
  });

  it("uses explicit editor preferences and the public URL locale", () => {
    expect(resolveInitialAppLocale("editor", "?locale=fr", "de")).toBe("fr");
    expect(resolveInitialAppLocale("editor", "", "de")).toBe("de");
    expect(resolveInitialAppLocale("editor", "", null)).toBe("en");
    expect(resolveInitialAppLocale("editor", "?locale=fr", "de", "/it-IT/dashboard")).toBe("it");
    expect(resolveInitialAppLocale("public", "?locale=ar", "ja", "/it-IT")).toBe("it");
    expect(resolveInitialAppLocale("public", "?locale=ar", "ja", "/en-US")).toBe("en");
    expect(resolveInitialAppLocale("public", "", null, "/orbitpage/it-IT", "/orbitpage")).toBe("it");
  });

  it("keeps the emergency fallback in the active interface language", () => {
    expect(resolveApplicationErrorLocale("editor", "?locale=fr", "de", "it-IT")).toBe("fr");
    expect(resolveApplicationErrorLocale("editor", "", "de", "it-IT")).toBe("de");
    expect(resolveApplicationErrorLocale("public", "?locale=fr", "de", "ar-SA")).toBe("ar");
  });
});
