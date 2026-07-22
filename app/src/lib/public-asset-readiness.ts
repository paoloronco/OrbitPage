import type { LinkData } from "@/components/LinkCard";
import { internalAssetPath } from "@/lib/base-path";
import { resolveSafePublicMediaUrl } from "@/lib/browser-network-policy";
import type { BackgroundMediaConfig } from "@/lib/theme";

const MAX_CRITICAL_IMAGES = 10;
const DEFAULT_WAIT_MS = 1_800;

export function resolvePublicImageUrl(value?: string | null) {
  const safeUrl = resolveSafePublicMediaUrl(value);
  if (!safeUrl) return null;
  if (safeUrl.startsWith("/") || (!safeUrl.includes(":") && !safeUrl.startsWith("//"))) {
    return internalAssetPath(safeUrl);
  }
  return safeUrl;
}

export function collectCriticalPublicImageUrls(input: {
  avatar?: string | null;
  showAvatar?: boolean;
  links: LinkData[];
  backgroundMedia?: BackgroundMediaConfig | null;
}) {
  const candidates: Array<string | null> = [];

  if (input.showAvatar !== false) candidates.push(resolvePublicImageUrl(input.avatar));
  if (input.backgroundMedia?.type === "gif") {
    candidates.push(resolvePublicImageUrl(input.backgroundMedia.mediaUrl));
  }

  for (const link of input.links) {
    if (link.isActive === false) continue;
    if (link.iconType !== "emoji") candidates.push(resolvePublicImageUrl(link.icon));
    candidates.push(resolvePublicImageUrl(link.coverImage));
    if (link.type === "image") candidates.push(resolvePublicImageUrl(link.coverImage || link.url));
    if (candidates.filter(Boolean).length >= MAX_CRITICAL_IMAGES) break;
  }

  return [...new Set(candidates.filter((value): value is string => Boolean(value)))].slice(0, MAX_CRITICAL_IMAGES);
}

function preloadImage(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    image.onload = () => {
      if (typeof image.decode === "function") image.decode().catch(() => undefined).finally(finish);
      else finish();
    };
    image.onerror = finish;
    image.src = url;

    if (image.complete) {
      if (typeof image.decode === "function") image.decode().catch(() => undefined).finally(finish);
      else finish();
    }
  });
}

export async function waitForCriticalPublicImages(urls: string[], timeoutMs = DEFAULT_WAIT_MS) {
  if (typeof Image === "undefined" || urls.length === 0) return;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.all(urls.map(preloadImage)),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, timeoutMs);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
}
