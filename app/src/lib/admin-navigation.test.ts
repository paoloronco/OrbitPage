import { describe, expect, it } from "vitest";
import {
  ADMIN_SECTION_CHANGED_MESSAGE,
  adminDashboardPath,
  adminTabFromLocation,
  isAdminSectionMessage,
  isAdminTab,
} from "./admin-navigation";

describe("admin navigation", () => {
  it("maps standalone dashboard paths to tabs", () => {
    expect(adminTabFromLocation("/dashboard/profile")).toBe("profile");
    expect(adminTabFromLocation("/dashboard/links")).toBe("links");
    expect(adminTabFromLocation("/orbitpage/dashboard/theme")).toBe("theme");
  });

  it("keeps the hosted query bridge and legacy admin route compatible", () => {
    expect(adminTabFromLocation("/admin", "?section=analytics")).toBe("analytics");
    expect(adminTabFromLocation("/admin/privacy")).toBe("privacy");
    expect(adminTabFromLocation("/admin", "?section=unknown")).toBe("profile");
  });

  it("builds only known dashboard destinations", () => {
    expect(adminDashboardPath("backup")).toBe("/dashboard/backup");
    expect(isAdminTab("txt")).toBe(true);
    expect(adminDashboardPath("sitemap")).toBe("/dashboard/sitemap");
    expect(isAdminTab("sitemap")).toBe(true);
    expect(adminDashboardPath("menu")).toBe("/dashboard/menu");
    expect(isAdminTab("menu")).toBe(true);
    expect(adminDashboardPath("qr")).toBe("/dashboard/qr");
    expect(isAdminTab("qr")).toBe(true);
    expect(isAdminTab("billing")).toBe(false);
  });

  it("validates iframe navigation messages", () => {
    expect(isAdminSectionMessage(
      { type: ADMIN_SECTION_CHANGED_MESSAGE, section: "links" },
      ADMIN_SECTION_CHANGED_MESSAGE,
    )).toBe(true);
    expect(isAdminSectionMessage(
      { type: ADMIN_SECTION_CHANGED_MESSAGE, section: "billing" },
      ADMIN_SECTION_CHANGED_MESSAGE,
    )).toBe(false);
  });
});
