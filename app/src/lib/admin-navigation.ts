export const ADMIN_TAB_IDS = [
  "profile",
  "links",
  "pages",
  "theme",
  "menu",
  "qr",
  "access",
  "backup",
  "analytics",
  "privacy",
  "txt",
  "sitemap",
] as const;

export type AdminTab = (typeof ADMIN_TAB_IDS)[number];

export const ADMIN_SECTION_CHANGED_MESSAGE = "orbitpage:admin-section-changed";
export const ADMIN_SECTION_NAVIGATE_MESSAGE = "orbitpage:admin-section-navigate";

export function isAdminTab(value: unknown): value is AdminTab {
  return typeof value === "string" && ADMIN_TAB_IDS.includes(value as AdminTab);
}

export function adminDashboardPath(tab: AdminTab = "profile") {
  return `/dashboard/${tab}`;
}

export function adminTabFromLocation(pathname: string, search = "") {
  const queryTab = new URLSearchParams(search).get("section");
  if (isAdminTab(queryTab)) return queryTab;

  const segments = pathname.split("/").filter(Boolean);
  const routeIndex = segments.findIndex((segment) => segment === "dashboard" || segment === "admin");
  const pathTab = routeIndex >= 0 ? segments[routeIndex + 1] : null;
  return isAdminTab(pathTab) ? pathTab : "profile";
}

export function isAdminSectionMessage(data: unknown, type: string): data is { type: string; section: AdminTab } {
  if (!data || typeof data !== "object") return false;
  const candidate = data as { type?: unknown; section?: unknown };
  return candidate.type === type && isAdminTab(candidate.section);
}
