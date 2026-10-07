import { getEditorIntegration } from "./editor-integration";

export const getPublicUrlOverride = (): string | null => {
  if (typeof window === "undefined") return null;

  const value = getEditorIntegration()?.publicUrl;
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};
