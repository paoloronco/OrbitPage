export const PUBLIC_LOCALES = [
  ['en', 'en-US'], ['it', 'it-IT'], ['es', 'es-ES'], ['fr', 'fr-FR'], ['de', 'de-DE'],
  ['pt', 'pt-PT'], ['nl', 'nl-NL'], ['pl', 'pl-PL'], ['tr', 'tr-TR'], ['ru', 'ru-RU'],
  ['ar', 'ar-SA'], ['zh', 'zh-CN'], ['ja', 'ja-JP'], ['ko', 'ko-KR'],
];

const LOCALE_BY_VALUE = new Map(PUBLIC_LOCALES.flatMap(([locale, slug]) => [
  [locale.toLowerCase(), { locale, slug }],
  [slug.toLowerCase(), { locale, slug }],
]));
const PAGE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

export const normalizePublicLocale = (value) => LOCALE_BY_VALUE.get(String(value || '').trim().toLowerCase()) || LOCALE_BY_VALUE.get('en');

export const localizedPublicPath = (localeValue, pageSlug, routePath = '/') => {
  const { slug } = normalizePublicLocale(localeValue);
  const suffix = routePath === '/' ? '' : `/${String(routePath).replace(/^\/+|\/+$/g, '')}`;
  return `/${slug}/${pageSlug}${suffix}`;
};

export const parseLocalizedPublicPath = (pathName, pageSlug) => {
  if (!pageSlug || !PAGE_SLUG_PATTERN.test(pageSlug)) return null;
  const [localeValue, requestedSlug, ...routeSegments] = String(pathName || '').split('/').filter(Boolean);
  const locale = LOCALE_BY_VALUE.get(String(localeValue || '').toLowerCase());
  if (!locale || requestedSlug !== pageSlug) return null;
  return { ...locale, routePath: routeSegments.length ? `/${routeSegments.join('/')}` : '/' };
};

export const localizedAlternates = (origin, basePath, pageSlug, routePath = '/') => Object.fromEntries([
  ...PUBLIC_LOCALES.map(([locale, slug]) => [slug, new URL(`${basePath}${localizedPublicPath(locale, pageSlug, routePath)}`, `${origin}/`).toString()]),
  ['x-default', new URL(`${basePath}${localizedPublicPath('en', pageSlug, routePath)}`, `${origin}/`).toString()],
]);
