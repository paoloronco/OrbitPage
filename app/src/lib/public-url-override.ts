import { getHostedSurfaceConfig } from "./hosted-surface";
import { isHostedRuntime } from "./runtime-mode";

export const getPublicUrlOverride = (): string | null => {
  if (!isHostedRuntime() || typeof window === "undefined") return null;

  const value = getHostedSurfaceConfig()?.publicUrl;
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};
