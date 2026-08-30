import type { AdminTab } from "./admin-navigation";
import type { ContentDestination, ContentRouting } from "./menu";
import { isHostedRuntime } from "./runtime-mode";

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
      homepage?: boolean;
      selected?: boolean;
    };
  };
  contentSection?: ContentDestination;
  onContentRoutingChange?: (routing: ContentRouting) => void;
  onContentSectionChange?: (section: ContentDestination) => void;
  onShopStatusChange?: (enabled: boolean) => Promise<void>;
  onOpenShop?: () => void;
  onReady?: () => void;
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
  return isHostedRuntime() && typeof window !== "undefined" && window.__ORBITPAGE_HOSTED_SURFACE__ === true;
}

export function getHostedSurfaceConfig(): HostedSurfaceConfig | null {
  return isHostedRuntime() && typeof window !== "undefined"
    ? window.__ORBITPAGE_HOSTED_CONFIG__ || null
    : null;
}

export function getHostedThemeRoot(): HTMLElement {
  return isHostedRuntime() && typeof window !== "undefined" && window.__ORBITPAGE_HOSTED_THEME_ROOT__
    ? window.__ORBITPAGE_HOSTED_THEME_ROOT__
    : document.documentElement;
}

export function configureHostedSurface(root: HTMLElement, config: HostedSurfaceConfig): void {
  if (!isHostedRuntime()) {
    throw new Error("The hosted editor surface is unavailable in the self-hosted build.");
  }
  window.__ORBITPAGE_HOSTED_SURFACE__ = true;
  window.__ORBITPAGE_HOSTED_CONFIG__ = config;
  window.__ORBITPAGE_HOSTED_THEME_ROOT__ = root;
  window.__ORBITPAGE_API_BASE__ = config.apiBase;
  root.lang = config.locale;
  localStorage.setItem("orbitpage.locale", config.locale);
}
