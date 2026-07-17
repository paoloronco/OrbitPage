/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLocale = "en" | "it";

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

function initialLocale(): AppLocale {
  if (typeof window === "undefined") return "en";
  const queryLocale = new URLSearchParams(window.location.search).get("locale");
  if (queryLocale === "en" || queryLocale === "it") return queryLocale;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "it") return stored;
  return navigator.languages?.some((language) => language.toLowerCase().startsWith("it")) ? "it" : "en";
}

export function AppI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const tr = useCallback((english: string, italian: string) => locale === "it" ? italian : english, [locale]);
  const value = useMemo(() => ({ locale, setLocale, tr }), [locale, setLocale, tr]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useAppI18n() {
  return useContext(I18nContext);
}
