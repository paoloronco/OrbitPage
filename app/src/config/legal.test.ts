import { describe, expect, it } from "vitest";
import { getEffectivePolicyUrl } from "./legal";

describe("getEffectivePolicyUrl", () => {
  it.each([
    ["privacy", "hosted", "https://legacy.example/privacy", "/privacy"],
    ["cookie", "embedded", "https://legacy.example/cookies", "/cookies"],
  ] as const)("uses the local %s route for %s policies", (kind, mode, profileUrl, expected) => {
    expect(getEffectivePolicyUrl(kind, mode, undefined, profileUrl)).toBe(expected);
  });

  it("prefers a configured external policy URL over the profile fallback", () => {
    expect(
      getEffectivePolicyUrl(
        "privacy",
        "external",
        "https://current.example/privacy",
        "https://legacy.example/privacy",
      ),
    ).toBe("https://current.example/privacy");
  });

  it("preserves legacy profile policy URLs when no external URL is configured", () => {
    expect(
      getEffectivePolicyUrl("cookie", "external", "", "https://legacy.example/cookies"),
    ).toBe("https://legacy.example/cookies");
  });
});
