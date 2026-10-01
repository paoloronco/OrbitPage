import { publicLocaleFromSlug, publicLocaleSlug } from "./public-routing";

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
export type AdminEditorSection = "profile" | AdminContentSection;

export const ADMIN_SUBSECTIONS = {
  menu: ["settings", "content", "design"],
  shop: ["legal", "payments", "design", "products", "orders", "customers"],
  theme: ["page", "card"],
  publish: ["QR", "Sitemap", "TXT"],
  newsletter: ["overview", "campaigns", "subscribers", "settings"],
  account: ["general", "security"],
} as const;
export type AdminSubsectionScope = keyof typeof ADMIN_SUBSECTIONS;

export function adminSubsectionFromLocation(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const index = segments.findIndex((segment) => segment === "dashboard" || segment === "admin");
  const editor = segments[index + 1] === "editor";
  const scope = segments[index + (editor ? 2 : 1)];
  const subsection = segments[index + (editor ? 3 : 2)];
  if (index < 0 || segments.length !== index + (editor ? 4 : 3)
    || (editor ? scope !== "menu" && scope !== "shop" : scope === "menu" || scope === "shop")) return null;
  const options = Object.prototype.hasOwnProperty.call(ADMIN_SUBSECTIONS, scope) ? ADMIN_SUBSECTIONS[scope as AdminSubsectionScope] : [];
  return options.find((value) => value.toLowerCase() === subsection?.toLowerCase()) || null;
}

export function adminSubsectionPath(scope: AdminSubsectionScope, subsection: string, locale?: string | null) {
  const slug = ADMIN_SUBSECTIONS[scope].find((value) => value.toLowerCase() === subsection.toLowerCase());
  if (!slug) throw new Error("Unknown dashboard subsection");
  const base = scope === "menu" || scope === "shop" ? adminEditorPath(scope, locale) : adminDashboardPath(scope, "link", locale);
  return `${base}/${slug}`;
}

function adminLocalePrefix(locale?: string | null) {
  return locale ? `/${publicLocaleSlug(locale)}` : "";
}

export function isAdminLocation(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const routeIndex = segments.findIndex((segment) => segment === "dashboard" || segment === "admin");
  return routeIndex === 0 || (routeIndex === 1 && Boolean(publicLocaleFromSlug(segments[0])));
}

export function adminEditorPath(section: AdminEditorSection, locale?: string | null) {
  return `${adminLocalePrefix(locale)}/dashboard/editor/${section === "profile" ? "page" : section === "link" ? "content" : section}`;
}

export function adminEditorSectionFromLocation(pathname: string): AdminEditorSection | null {
  const segments = pathname.split("/").filter(Boolean);
  const dashboardIndex = segments.indexOf("dashboard");
  const section = dashboardIndex >= 0 && segments[dashboardIndex + 1] === "editor" ? segments[dashboardIndex + 2] : null;
  if (section === "page") return "profile";
  if (section === "content") return "link";
  return isAdminContentSection(section) && section !== "link" ? section : null;
}

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

export function adminDashboardPath(tab: AdminTab = "profile", contentSection: AdminContentSection = "link", locale?: string | null) {
  const canonical = canonicalAdminTab(tab);
  const prefix = adminLocalePrefix(locale);
  return canonical === "content" ? `${prefix}/dashboard/content/${contentSection}` : `${prefix}/dashboard/${canonical}`;
}

export function adminContentSectionFromLocation(pathname: string, fallback: AdminContentSection = "link") {
  const editorSection = adminEditorSectionFromLocation(pathname);
  if (editorSection) return editorSection === "profile" ? "link" : editorSection;
  const segments = pathname.split("/").filter(Boolean);
  const routeIndex = segments.findIndex((segment) => segment === "dashboard" || segment === "admin");
  const contentSection = routeIndex >= 0 && segments[routeIndex + 1] === "content" ? segments[routeIndex + 2] : null;
  if (isAdminContentSection(contentSection)) return contentSection;
  if (contentSection === "home" || segments[routeIndex + 1] === "links") return "link";
  return fallback;
}

export function adminTabFromLocation(pathname: string, search = "") {
  if (adminEditorSectionFromLocation(pathname)) return "profile";
  const segments = pathname.split("/").filter(Boolean);
  const routeIndex = segments.findIndex((segment) => segment === "dashboard" || segment === "admin");
  const pathTab = routeIndex >= 0 ? segments[routeIndex + 1] : null;
  if (adminSubsectionFromLocation(pathname) && isAdminTab(pathTab)) return canonicalAdminTab(pathTab);
  const queryTab = new URLSearchParams(search).get("section");
  if (isAdminTab(queryTab)) return canonicalAdminTab(queryTab);

  return isAdminTab(pathTab) ? canonicalAdminTab(pathTab) : "profile";
}
