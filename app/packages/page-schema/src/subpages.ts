import { z } from "zod";
import {
  ORBITPAGE_MAX_SUBPAGES,
  OrbitPageBlockIdSchema,
  OrbitPageIsoDateSchema,
  boundedString,
  generatedId,
  parseOrThrow
} from "./primitives";
import {
  OrbitPageBlocksSchema,
  normalizeStoredOrbitPageBlocks,
  parseOrbitPageBlocks
} from "./blocks";

const SUBPAGE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const RESERVED_SUBPAGE_SLUGS = new Set([
  "admin", "api", "assets", "cookies", "dashboard", "favicon.ico", "login", "media", "menu",
  "orbitpage-runtime", "privacy", "robots.txt", "shop", "sitemap.xml", "support", "terms", "www"
]);

export function normalizeOrbitPageSubpageSlug(value: unknown) {
  const slug = typeof value === "string"
    ? value.trim().slice(0, 48)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
    : "";
  if (!SUBPAGE_SLUG_PATTERN.test(slug) || RESERVED_SUBPAGE_SLUGS.has(slug)) return "";
  return slug;
}

export const OrbitPageSubpageSchema = z.object({
  id: OrbitPageBlockIdSchema,
  slug: z.string().regex(SUBPAGE_SLUG_PATTERN)
    .refine((slug) => !RESERVED_SUBPAGE_SLUGS.has(slug), "This page slug is reserved."),
  title: boundedString(80).trim().min(1),
  description: boundedString(240).trim(),
  links: OrbitPageBlocksSchema,
  enabled: z.boolean(),
  createdAt: OrbitPageIsoDateSchema,
  updatedAt: OrbitPageIsoDateSchema
}).strict();

export const OrbitPageSubpagesSchema = z.array(OrbitPageSubpageSchema).max(ORBITPAGE_MAX_SUBPAGES)
  .superRefine((pages, context) => {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    pages.forEach((page, index) => {
      if (ids.has(page.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Page IDs must be unique." });
      if (slugs.has(page.slug)) context.addIssue({ code: "custom", path: [index, "slug"], message: "Page slugs must be unique." });
      ids.add(page.id);
      slugs.add(page.slug);
    });
  });

export type OrbitPageSubpage = z.infer<typeof OrbitPageSubpageSchema>;

const SubpageInputShape = {
  id: z.union([OrbitPageBlockIdSchema, z.number().int().nonnegative()]).optional(),
  slug: boundedString(80),
  title: boundedString(80),
  description: boundedString(240).nullable().optional(),
  links: z.array(z.unknown()).max(150).optional(),
  enabled: z.boolean().optional(),
  createdAt: OrbitPageIsoDateSchema.optional(),
  updatedAt: OrbitPageIsoDateSchema.optional()
};

const StrictSubpageInputSchema = z.object(SubpageInputShape).strict();
const LegacySubpageInputSchema = z.object(SubpageInputShape);

function normalizeSubpages(value: unknown, strict: boolean) {
  if (!Array.isArray(value)) {
    if (strict) throw new Error("Pages must be provided as a list.");
    return [];
  }
  if (value.length > ORBITPAGE_MAX_SUBPAGES) {
    throw new Error(`A workspace cannot contain more than ${ORBITPAGE_MAX_SUBPAGES} pages.`);
  }
  const now = new Date().toISOString();
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const pages = value.map((candidate) => {
    const input = parseOrThrow(
      strict ? StrictSubpageInputSchema : LegacySubpageInputSchema,
      candidate,
      "One of the pages contains invalid or unsupported data."
    );
    const slug = normalizeOrbitPageSubpageSlug(input.slug);
    if (!slug) throw new Error("Use a page slug made of letters, numbers and hyphens.");
    if (slugs.has(slug)) throw new Error(`The page slug "${slug}" is already in use.`);
    slugs.add(slug);
    const requestedId = String(input.id ?? "");
    let id = OrbitPageBlockIdSchema.safeParse(requestedId).success ? requestedId : generatedId("page");
    if (ids.has(id)) {
      if (strict) throw new Error(`Page IDs must be unique: ${id}`);
      id = generatedId("page");
    }
    ids.add(id);
    return {
      id,
      slug,
      title: input.title.trim(),
      description: (input.description ?? "").trim(),
      links: strict
        ? parseOrbitPageBlocks(input.links ?? [])
        : normalizeStoredOrbitPageBlocks(input.links ?? []),
      enabled: input.enabled !== false,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    };
  });
  return parseOrThrow(OrbitPageSubpagesSchema, pages, "One of the pages contains invalid or unsupported data.");
}

export function parseOrbitPageSubpages(value: unknown) {
  return normalizeSubpages(value, true);
}

export function normalizeStoredOrbitPageSubpages(value: unknown) {
  return normalizeSubpages(value, false);
}
