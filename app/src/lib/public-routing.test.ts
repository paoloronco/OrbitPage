import { describe, expect, it } from "vitest";
import { localizedPublicPath, parseLocalizedPublicPath, publicLocaleSlug } from "./public-routing";

describe("localized public routing", () => {
  it("builds and parses locale-prefixed page routes", () => {
    expect(localizedPublicPath("it", "paolo")).toBe("/it-IT/paolo");
    expect(localizedPublicPath("en", "paolo", "/menu")).toBe("/en-US/paolo/menu");
    expect(parseLocalizedPublicPath("/orbitpage/it-IT/paolo/services", "/orbitpage")).toEqual({
      locale: "it", localeSlug: "it-IT", pageSlug: "paolo", routePath: "/services",
    });
    expect(parseLocalizedPublicPath("/dashboard/profile")).toBeNull();
    expect(publicLocaleSlug("it-IT")).toBe("it-IT");
  });
});
