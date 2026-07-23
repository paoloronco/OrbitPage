import type { AdminTab } from "./admin-navigation";

export type HostedSurfaceConfig = {
  apiBase: string;
  publicSlug: string;
  publicUrl: string;
  apiToken: string;
  appCheckToken?: string | null;
  section: AdminTab;
  locale: string;
  extensions?: {
    shop?: {
      entitled: boolean;
      enabled?: boolean;
      selected?: boolean;
    };
  };
  onContentSectionChange?: (section: "home" | "menu" | "pages" | "shop") => void;
  onOpenShop?: () => void;
};

declare global {
  interface Window {
    __ORBITPAGE_HOSTED_SURFACE__?: boolean;
    __ORBITPAGE_HOSTED_CONFIG__?: HostedSurfaceConfig;
    __ORBITPAGE_HOSTED_THEME_ROOT__?: HTMLElement;
  }
}

export const HOSTED_SECTION_CHANGED_EVENT = "orbitpage:admin-section-changed";
export const HOSTED_SECTION_NAVIGATE_EVENT = "orbitpage:admin-section-navigate";
export const HOSTED_CONFIG_CHANGED_EVENT = "orbitpage:hosted-config-changed";

export function isIntegratedHostedSurface(): boolean {
  return typeof window !== "undefined" && window.__ORBITPAGE_HOSTED_SURFACE__ === true;
}

export function getHostedSurfaceConfig(): HostedSurfaceConfig | null {
  return typeof window !== "undefined" ? window.__ORBITPAGE_HOSTED_CONFIG__ || null : null;
}

export function getHostedThemeRoot(): HTMLElement {
  return typeof window !== "undefined" && window.__ORBITPAGE_HOSTED_THEME_ROOT__
    ? window.__ORBITPAGE_HOSTED_THEME_ROOT__
    : document.documentElement;
}

export function configureHostedSurface(root: HTMLElement, config: HostedSurfaceConfig): void {
  window.__ORBITPAGE_HOSTED_SURFACE__ = true;
  window.__ORBITPAGE_HOSTED_CONFIG__ = config;
  window.__ORBITPAGE_HOSTED_THEME_ROOT__ = root;
  window.__ORBITPAGE_API_BASE__ = config.apiBase;
  root.lang = config.locale;
  localStorage.setItem("orbitpage.locale", config.locale);
}
