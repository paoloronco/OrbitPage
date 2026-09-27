export const PUBLIC_LOCALES = [
  { locale: "en", slug: "en-US" },
  { locale: "it", slug: "it-IT" },
  { locale: "es", slug: "es-ES" },
  { locale: "fr", slug: "fr-FR" },
  { locale: "de", slug: "de-DE" },
  { locale: "pt", slug: "pt-PT" },
  { locale: "nl", slug: "nl-NL" },
  { locale: "pl", slug: "pl-PL" },
  { locale: "tr", slug: "tr-TR" },
  { locale: "ru", slug: "ru-RU" },
  { locale: "ar", slug: "ar-SA" },
  { locale: "zh", slug: "zh-CN" },
  { locale: "ja", slug: "ja-JP" },
  { locale: "ko", slug: "ko-KR" },
] as const;

export type PublicLocale = typeof PUBLIC_LOCALES[number]["locale"];
export type PublicLocaleSlug = typeof PUBLIC_LOCALES[number]["slug"];

const LOCALE_BY_SLUG = new Map(PUBLIC_LOCALES.map((entry) => [entry.slug.toLowerCase(), entry]));
const SLUG_BY_LOCALE = new Map(PUBLIC_LOCALES.map((entry) => [entry.locale, entry.slug]));
const PAGE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

export function publicLocaleFromSlug(value: string | null | undefined) {
  return value ? LOCALE_BY_SLUG.get(value.toLowerCase()) || null : null;
}

export function publicLocaleSlug(locale: string | null | undefined): PublicLocaleSlug {
  return (locale && SLUG_BY_LOCALE.get(locale.split("-")[0].toLowerCase() as PublicLocale)) || "en-US";
}

export function localizedPublicPath(locale: string, pageSlug: string, routePath = "/") {
  const suffix = routePath === "/" ? "" : `/${routePath.replace(/^\/+|\/+$/g, "")}`;
  return `/${publicLocaleSlug(locale)}/${pageSlug}${suffix}`;
}

export function parseLocalizedPublicPath(pathname: string, basePath = "") {
  const relativePath = pathname.slice(basePath.length).replace(/^\/+|\/+$/g, "");
  const [localeSegment, pageSlug, ...routeSegments] = relativePath.split("/");
  const locale = publicLocaleFromSlug(localeSegment);
  if (!locale || !pageSlug || !PAGE_SLUG_PATTERN.test(pageSlug)) return null;
  return {
    locale: locale.locale,
    localeSlug: locale.slug,
    pageSlug,
    routePath: routeSegments.length ? `/${routeSegments.join("/")}` : "/",
  };
}
