import type { EmbedProvider, ServiceLinkProvider } from "./link-blocks";

export type BrandServiceProvider = Extract<
  Exclude<EmbedProvider, "auto"> | ServiceLinkProvider,
  "instagram" | "youtube" | "spotify" | "deezer" | "soundcloud" | "vimeo" | "tiktok" | "giphy" | "whatsapp" | "github"
>;

export const brandServiceColors: Record<BrandServiceProvider, string> = {
  instagram: "#E4405F",
  whatsapp: "#25D366",
  youtube: "#FF0000",
  spotify: "#1ED760",
  deezer: "#A238FF",
  soundcloud: "#FF5500",
  vimeo: "#1AB7EA",
  tiktok: "#111111",
  giphy: "#6A5CFF",
  github: "#181717",
};

export const isBrandServiceProvider = (provider: string): provider is BrandServiceProvider => (
  Object.prototype.hasOwnProperty.call(brandServiceColors, provider)
);
