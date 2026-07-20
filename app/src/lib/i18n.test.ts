import { describe, expect, it } from "vitest";
import { APP_LOCALES, normalizeAppLocale, resolveInitialAppLocale } from "./i18n";

describe("editor i18n", () => {
  it("supports the same locale families as the managed site", () => {
    expect(APP_LOCALES).toEqual(["en", "it", "es", "fr", "de", "pt", "nl", "pl", "tr", "ru", "ar", "zh", "ja", "ko"]);
    expect(normalizeAppLocale("es-MX")).toBe("es");
    expect(normalizeAppLocale("zh-Hant")).toBe("zh");
    expect(normalizeAppLocale("ko-KR")).toBe("ko");
    expect(normalizeAppLocale("sv-SE")).toBeNull();
  });

  it("uses only explicit editor preferences and keeps public pages language-neutral", () => {
    expect(resolveInitialAppLocale("editor", "?locale=fr", "de")).toBe("fr");
    expect(resolveInitialAppLocale("editor", "", "de")).toBe("de");
    expect(resolveInitialAppLocale("editor", "", null)).toBe("en");
    expect(resolveInitialAppLocale("public", "?locale=ar", "ja")).toBe("en");
  });
});
