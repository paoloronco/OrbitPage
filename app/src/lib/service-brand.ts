import type { EmbedProvider, ServiceLinkProvider } from "./link-blocks";

export type BrandServiceProvider = Extract<
  Exclude<EmbedProvider, "auto"> | ServiceLinkProvider,
  "instagram" | "facebook" | "youtube" | "spotify" | "apple_music" | "deezer" | "soundcloud" | "mixcloud" | "vimeo" | "loom" | "tiktok" | "giphy" | "google_calendar" | "calendly" | "typeform" | "google_forms" | "whatsapp" | "github"
>;

export const brandServiceColors: Record<BrandServiceProvider, string> = {
  instagram: "#E4405F",
  facebook: "#0866FF",
  whatsapp: "#25D366",
  youtube: "#FF0000",
  spotify: "#1ED760",
  apple_music: "#FA243C",
  deezer: "#A238FF",
  soundcloud: "#FF5500",
  mixcloud: "#5000FF",
  vimeo: "#1AB7EA",
  loom: "#625DF5",
  tiktok: "#111111",
  giphy: "#6A5CFF",
  google_calendar: "#4285F4",
  calendly: "#006BFF",
  typeform: "#262627",
  google_forms: "#7248B9",
  github: "#181717",
};

export const isBrandServiceProvider = (provider: string): provider is BrandServiceProvider => (
  Object.prototype.hasOwnProperty.call(brandServiceColors, provider)
);
