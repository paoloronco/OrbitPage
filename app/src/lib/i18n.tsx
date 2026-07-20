/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export const APP_LOCALES = ["en", "it", "es", "fr", "de", "pt", "nl", "pl", "tr", "ru", "ar", "zh", "ja", "ko"] as const;
export type AppLocale = typeof APP_LOCALES[number];

export const APP_LOCALE_LABELS: Record<AppLocale, string> = {
  en: "EN", it: "IT", es: "ES", fr: "FR", de: "DE", pt: "PT", nl: "NL",
  pl: "PL", tr: "TR", ru: "RU", ar: "AR", zh: "中文", ja: "日本語", ko: "한국어",
};

type PhraseCatalog = Record<string, string>;
type AdditionalAppLocale = Exclude<AppLocale, "en" | "it">;
const SUPPORTED_APP_LOCALES = new Set<string>(APP_LOCALES);
const RTL_APP_LOCALES = new Set<AppLocale>(["ar"]);
const phraseCatalogLoaders: Record<AdditionalAppLocale, () => Promise<PhraseCatalog>> = {
  es: () => import("./translations/es.json").then((module) => module.default),
  fr: () => import("./translations/fr.json").then((module) => module.default),
  de: () => import("./translations/de.json").then((module) => module.default),
  pt: () => import("./translations/pt.json").then((module) => module.default),
  nl: () => import("./translations/nl.json").then((module) => module.default),
  pl: () => import("./translations/pl.json").then((module) => module.default),
  tr: () => import("./translations/tr.json").then((module) => module.default),
  ru: () => import("./translations/ru.json").then((module) => module.default),
  ar: () => import("./translations/ar.json").then((module) => module.default),
  zh: () => import("./translations/zh.json").then((module) => module.default),
  ja: () => import("./translations/ja.json").then((module) => module.default),
  ko: () => import("./translations/ko.json").then((module) => module.default),
};
const phraseCatalogs = new Map<AppLocale, PhraseCatalog>();
const phraseCatalogRequests = new Map<AdditionalAppLocale, Promise<PhraseCatalog>>();

type I18nValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  tr: (english: string, italian: string) => string;
};

const STORAGE_KEY = "orbitpage.locale";
const DEFAULT_I18N: I18nValue = {
  locale: "en",
  setLocale: () => undefined,
  tr: (english) => english,
};

const I18nContext = createContext<I18nValue>(DEFAULT_I18N);

export function normalizeAppLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  if (SUPPORTED_APP_LOCALES.has(normalized)) return normalized as AppLocale;
  const base = normalized.split("-")[0];
  return SUPPORTED_APP_LOCALES.has(base) ? base as AppLocale : null;
}

async function loadPhraseCatalog(locale: AppLocale) {
  if (locale === "en" || locale === "it") return {};
  const existing = phraseCatalogs.get(locale);
  if (existing) return existing;
  const pending = phraseCatalogRequests.get(locale) || phraseCatalogLoaders[locale]();
  phraseCatalogRequests.set(locale, pending);
  try {
    const catalog = await pending;
    phraseCatalogs.set(locale, catalog);
    return catalog;
  } finally {
    phraseCatalogRequests.delete(locale);
  }
}

function initialLocale(): AppLocale {
  if (typeof window === "undefined") return "en";
  const queryLocale = normalizeAppLocale(new URLSearchParams(window.location.search).get("locale"));
  if (queryLocale) return queryLocale;
  const stored = normalizeAppLocale(window.localStorage.getItem(STORAGE_KEY));
  if (stored) return stored;
  for (const language of navigator.languages || [navigator.language]) {
    const locale = normalizeAppLocale(language);
    if (locale) return locale;
  }
  return "en";
}

export function AppI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const localeRequest = useRef(0);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    const request = ++localeRequest.current;
    void loadPhraseCatalog(nextLocale).then(() => {
      if (localeRequest.current !== request) return;
      setLocaleState(nextLocale);
      setCatalogVersion((version) => version + 1);
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    });
  }, []);

  useEffect(() => {
    void loadPhraseCatalog(locale).then(() => setCatalogVersion((version) => version + 1));
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_APP_LOCALES.has(locale) ? "rtl" : "ltr";
  }, [locale]);

  const tr = useCallback((english: string, italian: string) => {
    if (locale === "it") return italian;
    if (locale === "en") return english;
    return phraseCatalogs.get(locale)?.[english] || english;
  }, [catalogVersion, locale]);
  const value = useMemo(() => ({ locale, setLocale, tr }), [locale, setLocale, tr]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useAppI18n() {
  return useContext(I18nContext);
}
