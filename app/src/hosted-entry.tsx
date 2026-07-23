import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AppI18nProvider } from "@/lib/i18n";
import Admin from "@/pages/Admin";
import {
  configureHostedSurface,
  HOSTED_CONFIG_CHANGED_EVENT,
  HOSTED_SECTION_NAVIGATE_EVENT,
  type HostedSurfaceConfig,
} from "@/lib/hosted-surface";
import "./index.css";

type HostedAdminController = {
  update(config: HostedSurfaceConfig): void;
  unmount(): void;
};

declare global {
  interface Window {
    OrbitPageHostedAdmin?: {
      mount(element: HTMLElement, config: HostedSurfaceConfig): HostedAdminController;
    };
  }
}

function renderAdmin(root: Root, config: HostedSurfaceConfig) {
  root.render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MemoryRouter initialEntries={[`/dashboard/${config.section}`]}>
          <AppI18nProvider mode="editor">
            <Admin />
          </AppI18nProvider>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

window.OrbitPageHostedAdmin = {
  mount(element, initialConfig) {
    element.classList.add("orbitpage-hosted-surface");
    configureHostedSurface(element, initialConfig);
    const root = createRoot(element);
    renderAdmin(root, initialConfig);

    return {
      update(config) {
        const previous = window.__ORBITPAGE_HOSTED_CONFIG__;
        configureHostedSurface(element, config);
        window.dispatchEvent(new CustomEvent(HOSTED_CONFIG_CHANGED_EVENT));
        if (previous?.section !== config.section) {
          window.dispatchEvent(new CustomEvent(HOSTED_SECTION_NAVIGATE_EVENT, {
            detail: { section: config.section },
          }));
        }
      },
      unmount() {
        root.unmount();
        element.replaceChildren();
        if (window.__ORBITPAGE_HOSTED_THEME_ROOT__ === element) {
          delete window.__ORBITPAGE_HOSTED_THEME_ROOT__;
          delete window.__ORBITPAGE_HOSTED_CONFIG__;
          delete window.__ORBITPAGE_HOSTED_SURFACE__;
        }
      },
    };
  },
};
