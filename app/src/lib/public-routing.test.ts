import { describe, expect, it } from "vitest";
import { localizedPublicPath, parseLocalizedPublicPath, publicLocaleSlug } from "./public-routing";

describe("localized public routing", () => {
  it("builds and parses locale-prefixed routes", () => {
    expect(localizedPublicPath("it")).toBe("/it-IT");
    expect(localizedPublicPath("en", "/menu")).toBe("/en-US/menu");
    expect(parseLocalizedPublicPath("/orbitpage/it-IT/services", "/orbitpage")).toEqual({
      locale: "it", localeSlug: "it-IT", routePath: "/services",
    });
    expect(parseLocalizedPublicPath("/dashboard/profile")).toBeNull();
    expect(publicLocaleSlug("it-IT")).toBe("it-IT");
  });
});
