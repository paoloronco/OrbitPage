import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { buildLockedQrUrl, buildTrackedQrUrl, qrContrastRatio } from "@/lib/qr-code";

describe("ProfileQrCode", () => {
  it("uses the shared Sitemap and TXT panel typography", () => {
    const source = readFileSync(new URL("./ProfileQrCode.tsx", import.meta.url), "utf8");
    expect(source).toContain('<Card className="admin-panel space-y-6">');
    expect(source).toContain('className="text-base font-semibold text-slate-950"');
    expect(source).toContain('className="mt-1 text-sm leading-6 text-slate-600"');
  });

  it("removes Smart QR links optimistically and dismisses status messages", () => {
    const source = readFileSync(new URL("./CampaignLinksManager.tsx", import.meta.url), "utf8");
    expect(source.indexOf("setLinks(next);")).toBeLessThan(source.indexOf("await campaignLinksApi.update(next)"));
    expect(source).toContain("window.setTimeout(() => setMessage(''), 3000)");
    expect(source).toContain("setLinks(previous);");
  });

  it("shows Smart QR configuration only below the selected Smart destination", () => {
    const source = readFileSync(new URL("./ProfileQrCode.tsx", import.meta.url), "utf8");
    const destinationSelector = source.indexOf('aria-label={tr("QR destination", "Destinazione QR")}');
    const conditionalManager = source.indexOf('settings.destination === "campaign" && (');
    expect(conditionalManager).toBeGreaterThan(destinationSelector);
    expect(source.slice(conditionalManager)).toContain("<CampaignLinksManager");
    expect(source).not.toContain('destination === "campaign" && !settings.campaignSlug');
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

  it("tags generated QR targets without replacing an existing campaign source", () => {
    expect(buildTrackedQrUrl("https://orbitpage.net/alice", "").url).toBe("https://orbitpage.net/alice?utm_source=qr&utm_medium=qr");
    expect(buildTrackedQrUrl("https://orbitpage.net/alice", "menu?utm_source=poster#hours").url)
      .toBe("https://orbitpage.net/alice/menu?utm_source=poster&utm_medium=qr#hours");
    expect(buildTrackedQrUrl("https://orbitpage.net/alice", "../bob").url).toBe("");
    expect(buildTrackedQrUrl("invalid", "").url).toBe("");
    expect(buildTrackedQrUrl("javascript:alert(1)", "").url).toBe("");
  });

  it("detects QR palettes with insufficient contrast", () => {
    expect(qrContrastRatio("#111827", "#ffffff")).toBeGreaterThan(4.5);
    expect(qrContrastRatio("#ffffff", "#ffffff")).toBe(1);
  });
});
