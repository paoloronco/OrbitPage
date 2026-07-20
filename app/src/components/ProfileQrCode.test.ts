import { describe, expect, it } from "vitest";

import { buildLockedQrUrl, qrContrastRatio } from "@/lib/qr-code";

describe("ProfileQrCode", () => {
  it("builds child targets below the unique tenant page", () => {
    expect(buildLockedQrUrl("https://orbitpage.net/alice", "menu")).toEqual({
      url: "https://orbitpage.net/alice/menu",
      error: "",
    });
  });

  it("blocks external and parent-directory targets", () => {
    expect(buildLockedQrUrl("https://orbitpage.net/alice", "https://example.com").url).toBe("");
    expect(buildLockedQrUrl("https://orbitpage.net/alice", "../bob").url).toBe("");
  });

  it("detects QR palettes with insufficient contrast", () => {
    expect(qrContrastRatio("#111827", "#ffffff")).toBeGreaterThan(4.5);
    expect(qrContrastRatio("#ffffff", "#ffffff")).toBe(1);
  });
});
