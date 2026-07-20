import { describe, expect, it } from "vitest";
import { APP_LOCALES, normalizeAppLocale } from "./i18n";

describe("editor i18n", () => {
  it("supports the same locale families as the managed site", () => {
    expect(APP_LOCALES).toEqual(["en", "it", "es", "fr", "de", "pt", "nl", "pl", "tr", "ru", "ar", "zh", "ja", "ko"]);
    expect(normalizeAppLocale("es-MX")).toBe("es");
    expect(normalizeAppLocale("zh-Hant")).toBe("zh");
    expect(normalizeAppLocale("ko-KR")).toBe("ko");
    expect(normalizeAppLocale("sv-SE")).toBeNull();
  });
});
