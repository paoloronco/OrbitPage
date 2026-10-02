import { describe, expect, it } from "vitest";
import {
  adminContentSectionFromLocation,
  adminDashboardPath,
  adminDefaultSubsection,
  adminEditorPath,
  adminEditorSectionFromLocation,
  adminTabFromLocation,
  isAdminLocation,
  isAdminTab,
  ADMIN_SUBSECTIONS,
  adminSubsectionFromLocation,
  adminSubsectionPath,
  type AdminSubsectionScope,
} from "./admin-navigation";

describe("admin navigation", () => {
  it("opens sections on the subsection they display by default", () => {
    expect(adminDefaultSubsection("menu")).toBe("content");
    expect(adminDefaultSubsection("shop")).toBe("products");
    expect(adminDefaultSubsection("theme")).toBe("page");
    expect(adminDefaultSubsection("publish")).toBe("QR");
    expect(adminDefaultSubsection("publish", false)).toBe("Sitemap");
    expect(adminDefaultSubsection("newsletter")).toBe("overview");
    expect(adminDefaultSubsection("account")).toBe("general");
    expect(adminDefaultSubsection("backup")).toBeNull();
  });
  it("round trips every dashboard subsection, locale and publishing alias", () => {
    for (const scope of Object.keys(ADMIN_SUBSECTIONS) as AdminSubsectionScope[]) {
      for (const subsection of ADMIN_SUBSECTIONS[scope]) {
        for (const locale of [undefined, "en", "it"]) {
          const path = adminSubsectionPath(scope, subsection, locale);
          expect(path).toContain(`/dashboard/${scope === "menu" || scope === "shop" ? "editor/" : ""}${scope}/${subsection}`);
          expect(adminSubsectionFromLocation(path)).toBe(subsection);
          expect(adminSubsectionFromLocation(path.toLowerCase())).toBe(subsection);
        }
      }
    }
    for (const path of ["/dashboard/account", "/dashboard/account/unknown", "/dashboard/account/security/extra", "/dashboard/toString/security", "/dashboard/editor/theme/card", "/dashboard/editor/menu/payments"]) {
      expect(adminSubsectionFromLocation(path)).toBeNull();
    }
    expect(() => adminSubsectionPath("account", "unknown")).toThrow();
    expect(adminTabFromLocation("/dashboard/account/security", "?section=theme")).toBe("account");
    expect(adminSubsectionFromLocation("/dashboard/menu/settings")).toBeNull();
    expect(adminSubsectionFromLocation("/dashboard/shop/legal")).toBeNull();
  });
  it("maps standalone dashboard paths to tabs", () => {
    expect(adminTabFromLocation("/dashboard/profile")).toBe("profile");
    expect(adminTabFromLocation("/dashboard/links")).toBe("content");
    expect(adminTabFromLocation("/dashboard/menu")).toBe("content");
    expect(adminTabFromLocation("/dashboard/pages")).toBe("content");
    expect(adminTabFromLocation("/orbitpage/dashboard/theme")).toBe("theme");
    expect(adminTabFromLocation("/dashboard/qr")).toBe("publish");
    expect(adminTabFromLocation("/dashboard/sitemap")).toBe("publish");
    expect(adminTabFromLocation("/dashboard/txt")).toBe("publish");
    expect(adminTabFromLocation("/dashboard/access")).toBe("account");
    expect(adminTabFromLocation("/dashboard/team")).toBe("team");
    expect(adminTabFromLocation("/dashboard/newsletter")).toBe("newsletter");
    expect(adminTabFromLocation("/dashboard/account")).toBe("account");
    expect(adminTabFromLocation("/dashboard/plan")).toBe("plan");
  });

  it("keeps the hosted surface and legacy admin route compatible", () => {
    expect(adminTabFromLocation("/admin", "?section=analytics")).toBe("analytics");
    expect(adminTabFromLocation("/admin/privacy")).toBe("privacy");
    expect(adminTabFromLocation("/admin", "?section=unknown")).toBe("profile");
  });

  it("builds only known dashboard destinations", () => {
    expect(adminDashboardPath("backup")).toBe("/dashboard/backup");
    expect(adminDashboardPath("access")).toBe("/dashboard/account");
    expect(adminDashboardPath("team")).toBe("/dashboard/team");
    expect(adminDashboardPath("account")).toBe("/dashboard/account");
    expect(adminDashboardPath("plan")).toBe("/dashboard/plan");
    expect(isAdminTab("txt")).toBe(true);
    expect(adminDashboardPath("sitemap")).toBe("/dashboard/publish");
    expect(isAdminTab("sitemap")).toBe(true);
    expect(adminDashboardPath("content")).toBe("/dashboard/content/link");
    expect(adminDashboardPath("content", "menu")).toBe("/dashboard/content/menu");
    expect(adminDashboardPath("menu")).toBe("/dashboard/content/link");
    expect(isAdminTab("content")).toBe(true);
    expect(isAdminTab("menu")).toBe(true);
    expect(adminDashboardPath("qr")).toBe("/dashboard/publish");
    expect(isAdminTab("qr")).toBe(true);
    expect(adminDashboardPath("publish")).toBe("/dashboard/publish");
    expect(isAdminTab("publish")).toBe(true);
    expect(isAdminTab("billing")).toBe(false);
    expect(adminDashboardPath("profile", "link", "it")).toBe("/it-IT/dashboard/profile");
    expect(adminEditorPath("link", "it")).toBe("/it-IT/dashboard/editor/content");
    expect(isAdminLocation("/it-IT/dashboard")).toBe(true);
    expect(isAdminLocation("/it-IT/portfolio")).toBe(false);
  });

  it("resolves nested Content destinations", () => {
    expect(adminContentSectionFromLocation("/dashboard/content/link")).toBe("link");
    expect(adminContentSectionFromLocation("/dashboard/content/menu")).toBe("menu");
    expect(adminContentSectionFromLocation("/dashboard/content/shop")).toBe("shop");
    expect(adminContentSectionFromLocation("/dashboard/content/pages")).toBe("pages");
  });

  it("keeps each visual editor destination in its own URL", () => {
    for (const [section, slug] of [["profile", "page"], ["link", "content"], ["menu", "menu"], ["shop", "shop"], ["pages", "pages"]] as const) {
      const path = adminEditorPath(section);
      expect(path).toBe(`/dashboard/editor/${slug}`);
      expect(adminEditorSectionFromLocation(path)).toBe(section);
      expect(adminContentSectionFromLocation(path)).toBe(section === "profile" ? "link" : section);
      expect(adminTabFromLocation(path)).toBe("profile");
      expect(adminTabFromLocation(path, "?section=theme")).toBe("profile");
    }
  });
});
