import { z } from "zod";
import {
  ORBITPAGE_PAGE_SCHEMA_VERSION,
  OrbitPageIsoDateSchema,
  boundedString,
  parseOrThrow
} from "./primitives";
import {
  DEFAULT_ORBITPAGE_PROFILE,
  OrbitPageProfileSchema,
  normalizeStoredOrbitPageProfile
} from "./profile";
import {
  OrbitPageBlocksSchema,
  normalizeStoredOrbitPageBlocks
} from "./blocks";
import {
  DEFAULT_ORBITPAGE_THEME,
  OrbitPageThemeSchema,
  normalizeOrbitPageTheme
} from "./theme";
import {
  DEFAULT_ORBITPAGE_MENU,
  OrbitPageMenuSchema,
  parseOrbitPageMenu
} from "./menu";
import {
  OrbitPageSubpagesSchema,
  normalizeStoredOrbitPageSubpages
} from "./subpages";
import {
  DEFAULT_ORBITPAGE_CONSENT_CONFIG,
  OrbitPageConsentConfigSchema,
  normalizeStoredOrbitPageConsentConfig
} from "./consent";
import {
  OrbitPageSitemapSchema,
  OrbitPageTextFilesSchema
} from "./discovery";

export const OrbitPageDocumentSchema = z.object({
  schemaVersion: z.literal(ORBITPAGE_PAGE_SCHEMA_VERSION),
  pageId: boundedString(128).min(1),
  tenantId: boundedString(128).min(1),
  ownerUid: boundedString(128).min(1),
  profile: OrbitPageProfileSchema,
  links: OrbitPageBlocksSchema,
  theme: OrbitPageThemeSchema,
  menu: OrbitPageMenuSchema,
  consentConfig: OrbitPageConsentConfigSchema,
  textFiles: OrbitPageTextFilesSchema,
  sitemap: OrbitPageSitemapSchema.optional(),
  subpages: OrbitPageSubpagesSchema,
  revision: z.number().int().nonnegative(),
  createdAt: OrbitPageIsoDateSchema,
  updatedAt: OrbitPageIsoDateSchema
}).strict();

export type OrbitPageDocument = z.infer<typeof OrbitPageDocumentSchema>;

export function parseOrbitPageDocument(value: unknown): OrbitPageDocument {
  return parseOrThrow(
    OrbitPageDocumentSchema,
    value,
    "The page document is invalid."
  );
}

const StoredDocumentInputSchema = z.object({
  schemaVersion: z.literal(ORBITPAGE_PAGE_SCHEMA_VERSION).optional(),
  pageId: boundedString(128).min(1),
  tenantId: boundedString(128).min(1),
  ownerUid: boundedString(128).min(1),
  profile: z.unknown().optional(),
  links: z.unknown().optional(),
  theme: z.unknown().optional(),
  menu: z.unknown().optional(),
  consentConfig: z.unknown().optional(),
  textFiles: z.unknown().optional(),
  sitemap: z.unknown().optional(),
  subpages: z.unknown().optional(),
  revision: z.number().int().nonnegative().optional(),
  createdAt: OrbitPageIsoDateSchema,
  updatedAt: OrbitPageIsoDateSchema
});

export function normalizeStoredOrbitPageDocument(value: unknown): OrbitPageDocument {
  const input = parseOrThrow(StoredDocumentInputSchema, value, "The page document is invalid.");
  const sitemapResult = OrbitPageSitemapSchema.safeParse(input.sitemap);
  return parseOrThrow(OrbitPageDocumentSchema, {
    schemaVersion: ORBITPAGE_PAGE_SCHEMA_VERSION,
    pageId: input.pageId,
    tenantId: input.tenantId,
    ownerUid: input.ownerUid,
    profile: normalizeStoredOrbitPageProfile(input.profile ?? DEFAULT_ORBITPAGE_PROFILE),
    links: normalizeStoredOrbitPageBlocks(input.links),
    theme: normalizeOrbitPageTheme(input.theme ?? DEFAULT_ORBITPAGE_THEME),
    menu: parseOrbitPageMenu(input.menu ?? DEFAULT_ORBITPAGE_MENU),
    consentConfig: normalizeStoredOrbitPageConsentConfig(input.consentConfig ?? DEFAULT_ORBITPAGE_CONSENT_CONFIG),
    textFiles: OrbitPageTextFilesSchema.safeParse(input.textFiles).success
      ? OrbitPageTextFilesSchema.parse(input.textFiles)
      : [],
    ...(sitemapResult.success ? { sitemap: sitemapResult.data } : {}),
    subpages: normalizeStoredOrbitPageSubpages(input.subpages),
    revision: input.revision ?? 0,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  }, "The page document is invalid.");
}

export const OrbitPageDocumentJsonSchema = z.toJSONSchema(OrbitPageDocumentSchema, {
  target: "draft-2020-12"
});
