import type { AdminTab, AdminSubsectionScope } from "./admin-navigation";
import type { ContentDestination, ContentRouting } from "./menu";
import type { WorkspaceBootstrapResponse } from "./api-client";
import type { PortableImage } from "./portable-backup";

/** Callbacks supplied by an application embedding the shared editor. */
export type EditorIntegration = {
  publicSlug: string;
  publicUrl: string;
  section: AdminTab;
  sectionDescription?: string;
  locale: string;
  apiPath: (endpoint: string) => string;
  request: (endpoint: string, options: RequestInit) => Promise<Response>;
  verify: () => Promise<{
    valid: boolean;
    user?: { username: string; role?: string; permissions?: string[]; readOnly?: boolean };
  }>;
  bootstrap: () => Promise<WorkspaceBootstrapResponse>;
  backupImages?: () => Promise<PortableImage[]>;
  uploadVideo?: (file: File, slot: string, purpose: "background" | "upload", onProgress?: (percentage: number) => void) => Promise<{ filePath: string; fullUrl: string; fileName: string }>;
  extensions?: {
    panels?: AdminTab[];
    shop?: { entitled: boolean; enabled?: boolean; homepage?: boolean; selected?: boolean };
  };
  workspace?: { roleLabel?: string; statusLabel?: string; status?: string };
  siteUrl?: string;
  onSignOut?: () => void;
  onLocaleChange?: (locale: string) => void;
  contentSection?: ContentDestination;
  subsection?: string | null;
  onSubsectionChange?: (scope: AdminSubsectionScope, subsection: string) => void;
  onContentRoutingChange?: (routing: ContentRouting) => void;
  onContentSectionChange?: (section: ContentDestination) => void;
  onShopStatusChange?: (enabled: boolean) => Promise<void>;
  onOpenShop?: () => void;
  onReady?: () => void;
};

let integration: EditorIntegration | null = null;
let themeRoot: HTMLElement | null = null;

export const EDITOR_SECTION_CHANGED_EVENT = "orbitpage:admin-section-changed";
export const EDITOR_SECTION_NAVIGATE_EVENT = "orbitpage:admin-section-navigate";
export const EDITOR_CONFIG_CHANGED_EVENT = "orbitpage:editor-config-changed";

export const isEmbeddedEditor = (): boolean => integration !== null;
export const getEditorIntegration = (): EditorIntegration | null => integration;
export const getEditorThemeRoot = (): HTMLElement => themeRoot || document.documentElement;

export function configureEditorIntegration(root: HTMLElement | null, config: EditorIntegration | null): void {
  integration = config;
  themeRoot = root;
  if (root && config) {
    root.lang = config.locale;
    localStorage.setItem("orbitpage.locale", config.locale);
  }
}
