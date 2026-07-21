import { getHostedSurfaceConfig } from "./hosted-surface";

export const getPublicUrlOverride = (): string | null => {
  if (typeof window === "undefined") return null;

  const value = getHostedSurfaceConfig()?.publicUrl || new URLSearchParams(window.location.search).get("publicUrl");
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};
