import { z } from "zod";

export const ORBITPAGE_PAGE_SCHEMA_VERSION = 1 as const;
export const ORBITPAGE_MAX_BLOCKS = 150;
export const ORBITPAGE_MAX_SUBPAGES = 20;

export const OrbitPageIdSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const OrbitPageBlockIdSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const OrbitPageHexColorSchema = z.string().trim().regex(/^#[0-9a-f]{6}$/i);
export const OrbitPageIsoDateSchema = z.string().datetime();

export function boundedString(maximum: number) {
  return z.string().max(maximum);
}

export function optionalString(maximum: number) {
  return z.string().max(maximum).nullable().optional();
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cleanOptionalString(value: unknown, maximum: number) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value.slice(0, maximum);
}

export function generatedId(prefix = "block") {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /^home\.arpa$/i,
  /\.home\.arpa$/i,
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(?:1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/i,
  /^\[?(?:fc|fd)[0-9a-f]{2}:/i,
  /^\[?fe[89ab][0-9a-f]:/i
] as const;

function hasControlCharacter(value: string) {
  return [...value].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point < 32 || point === 127;
  });
}

export function isSafePublicHref(value: string) {
  const candidate = value.trim();
  if (!candidate) return true;
  if (candidate.length > 2_048 || hasControlCharacter(candidate)) return false;
  if (candidate.startsWith("#")) return true;
  if (/^\/(?!\/)/.test(candidate)) return true;

  try {
    const parsed = new URL(candidate);
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === "mailto:" || parsed.protocol === "tel:") return true;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    return !PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}

/**
 * Converts a human-entered public destination into the canonical href stored by
 * OrbitPage. The editor historically accepted bare public hostnames such as
 * `example.com`; keeping that convenience at the input boundary avoids making
 * legacy data or ordinary form input fail a full-page save.
 */
export function normalizeOrbitPagePublicHref(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return "";
  if (isSafePublicHref(candidate)) return candidate;
  if (hasControlCharacter(candidate) || /\s/.test(candidate) || candidate.startsWith("//")) return null;

  const authority = candidate.split(/[/?#]/, 1)[0] ?? "";
  const publicHostnameWithOptionalPort =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?::\d{1,5})?$/i;
  if (!publicHostnameWithOptionalPort.test(authority)) return null;

  try {
    const parsed = new URL(`https://${candidate}`);
    return isSafePublicHref(parsed.toString()) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export const OrbitPagePublicHrefSchema = z.string().max(2_048)
  .refine(isSafePublicHref, "Use a public HTTP(S), mailto, tel, anchor, or relative-path URL.");

export const OrbitPagePublicHrefInputSchema = z.string().max(2_048)
  .refine(
    (value) => normalizeOrbitPagePublicHref(value) !== null,
    "Use a public HTTP(S), mailto, tel, anchor, relative-path URL, or public hostname."
  );

export const OrbitPageHrefCandidateSchema = z.string().max(2_048)
  .refine(
    (value) => !hasControlCharacter(value) && !/^\s*(?:javascript|data|vbscript|file|blob):/i.test(value),
    "Use a safe public destination."
  );

export function parseJsonObject(value: unknown, label: string): Record<string, unknown> {
  if (isPlainObject(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isPlainObject(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} content must be a JSON object.`);
  }
}

export function stableJsonObject(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

export function zodMessage(error: z.ZodError, fallback: string) {
  const first = error.issues[0];
  if (!first) return fallback;
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, fallback: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(zodMessage(result.error, fallback));
  return result.data;
}
