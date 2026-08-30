import { describe, expect, it } from "vitest";
import {
  adminContentSectionFromLocation,
  adminDashboardPath,
  adminTabFromLocation,
  isAdminTab,
} from "./admin-navigation";

describe("admin navigation", () => {
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
  });

  it("resolves nested Content destinations", () => {
    expect(adminContentSectionFromLocation("/dashboard/content/link")).toBe("link");
    expect(adminContentSectionFromLocation("/dashboard/content/menu")).toBe("menu");
    expect(adminContentSectionFromLocation("/dashboard/content/shop")).toBe("shop");
    expect(adminContentSectionFromLocation("/dashboard/content/pages")).toBe("pages");
  });
});
