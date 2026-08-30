export const ADMIN_TAB_IDS = [
  "profile",
  "content",
  "ai",
  // Legacy section ids stay valid for older bookmarks and hosted runtimes.
  "links",
  "pages",
  "theme",
  "menu",
  "publish",
  // Legacy publishing ids stay valid for older bookmarks and hosted runtimes.
  "qr",
  "team",
  "newsletter",
  "account",
  "plan",
  "access",
  "backup",
  "analytics",
  "privacy",
  "txt",
  "sitemap",
] as const;

export type AdminTab = (typeof ADMIN_TAB_IDS)[number];
export const ADMIN_CONTENT_SECTION_IDS = ["link", "menu", "shop", "pages"] as const;
export type AdminContentSection = (typeof ADMIN_CONTENT_SECTION_IDS)[number];

export function isAdminContentSection(value: unknown): value is AdminContentSection {
  return typeof value === "string" && ADMIN_CONTENT_SECTION_IDS.includes(value as AdminContentSection);
}

export function canonicalAdminTab(tab: AdminTab): AdminTab {
  if (tab === "links" || tab === "pages" || tab === "menu") return "content";
  if (tab === "qr" || tab === "txt" || tab === "sitemap") return "publish";
  if (tab === "access") return "account";
  return tab;
}

export function isAdminTab(value: unknown): value is AdminTab {
  return typeof value === "string" && ADMIN_TAB_IDS.includes(value as AdminTab);
}

export function adminDashboardPath(tab: AdminTab = "profile", contentSection: AdminContentSection = "link") {
  const canonical = canonicalAdminTab(tab);
  return canonical === "content" ? `/dashboard/content/${contentSection}` : `/dashboard/${canonical}`;
}

export function adminContentSectionFromLocation(pathname: string, fallback: AdminContentSection = "link") {
  const segments = pathname.split("/").filter(Boolean);
  const routeIndex = segments.findIndex((segment) => segment === "dashboard" || segment === "admin");
  const contentSection = routeIndex >= 0 && segments[routeIndex + 1] === "content" ? segments[routeIndex + 2] : null;
  if (isAdminContentSection(contentSection)) return contentSection;
  if (contentSection === "home" || segments[routeIndex + 1] === "links") return "link";
  return fallback;
}

export function adminTabFromLocation(pathname: string, search = "") {
  const queryTab = new URLSearchParams(search).get("section");
  if (isAdminTab(queryTab)) return canonicalAdminTab(queryTab);

  const segments = pathname.split("/").filter(Boolean);
  const routeIndex = segments.findIndex((segment) => segment === "dashboard" || segment === "admin");
  const pathTab = routeIndex >= 0 ? segments[routeIndex + 1] : null;
  return isAdminTab(pathTab) ? canonicalAdminTab(pathTab) : "profile";
}
