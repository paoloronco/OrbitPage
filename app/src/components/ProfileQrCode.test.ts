import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { buildLockedQrUrl, qrContrastRatio } from "@/lib/qr-code";

describe("ProfileQrCode", () => {
  it("uses the shared Sitemap and TXT panel typography", () => {
    const source = readFileSync(new URL("./ProfileQrCode.tsx", import.meta.url), "utf8");
    expect(source).toContain('<Card className="admin-panel space-y-6">');
    expect(source).toContain('className="text-base font-semibold text-slate-950"');
    expect(source).toContain('className="mt-1 text-sm leading-6 text-slate-600"');
  });

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
