/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_FORCE_ADMIN_ONBOARDING?: string;
  readonly VITE_ORBITPAGE_HOSTED_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
