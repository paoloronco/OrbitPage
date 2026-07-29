import { z } from "zod";
import {
  ORBITPAGE_MAX_BLOCKS,
  OrbitPageBlockIdSchema,
  OrbitPageHrefCandidateSchema,
  OrbitPageHexColorSchema,
  OrbitPagePublicHrefInputSchema,
  OrbitPagePublicHrefSchema,
  boundedString,
  generatedId,
  isPlainObject,
  normalizeOrbitPagePublicHref,
  parseJsonObject,
  parseOrThrow,
  stableJsonObject
} from "./primitives";

export const ORBITPAGE_BLOCK_TYPES = [
  "link",
  "menu",
  "text",
  "separator",
  "cta",
  "heading",
  "image",
  "video",
  "contact",
  "social_row",
  "callout",
  "map",
  "event",
  "embed"
] as const;

export const OrbitPageBlockTypeSchema = z.enum(ORBITPAGE_BLOCK_TYPES);
export type OrbitPageBlockType = z.infer<typeof OrbitPageBlockTypeSchema>;

const NullableString = (maximum: number) => boundedString(maximum).nullable().optional();
const NullableHex = OrbitPageHexColorSchema.nullable().optional();
const SurfaceEffectSchema = z.enum(["inherit", "solid", "transparent", "liquid-glass"]).nullable().optional();

const TextItemSchema = z.object({
  text: boundedString(500),
  url: OrbitPagePublicHrefSchema.nullable().optional(),
  textColor: NullableHex,
  surfaceEffect: SurfaceEffectSchema,
  fontSize: NullableString(40),
  fontFamily: NullableString(200)
}).strict();

const TextItemInputSchema = z.object({
  text: boundedString(500),
  url: OrbitPagePublicHrefInputSchema.nullable().optional(),
  textColor: NullableHex,
  surfaceEffect: SurfaceEffectSchema,
  fontSize: NullableString(40),
  fontFamily: NullableString(200)
}).strict();

const CommonBlockShape = {
  id: z.union([OrbitPageBlockIdSchema, z.number().int().nonnegative()]).optional(),
  title: boundedString(200).optional(),
  description: boundedString(2_000).nullable().optional(),
  url: OrbitPageHrefCandidateSchema.nullable().optional(),
  hideUrl: z.boolean().nullable().optional(),
  type: z.union([OrbitPageBlockTypeSchema, boundedString(40)]).optional(),
  icon: NullableString(2_048),
  iconType: z.enum(["emoji", "image", "svg"]).nullable().optional(),
  icon_type: z.enum(["emoji", "image", "svg"]).nullable().optional(),
  backgroundColor: NullableHex,
  textColor: NullableHex,
  surfaceEffect: SurfaceEffectSchema,
  titleFontSize: NullableString(40),
  titleFontFamily: NullableString(200),
  titleFont: NullableString(200),
  descriptionFontSize: NullableString(40),
  descriptionFontFamily: NullableString(200),
  alignment: z.enum(["left", "center", "right"]).nullable().optional(),
  size: z.enum(["small", "medium", "large"]).nullable().optional(),
  content: z.union([boundedString(20_000), z.record(z.string(), z.unknown())]).nullable().optional(),
  isActive: z.boolean().nullable().optional(),
  clickCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  ctaAction: z.enum(["book", "contact", "download", "subscribe", "buy"]).nullable().optional(),
  ctaClicks: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  status: z.enum(["draft", "live", "expired"]).nullable().optional(),
  campaignName: NullableString(120),
  startDate: NullableString(20),
  startTime: NullableString(20),
  endDate: NullableString(20),
  endTime: NullableString(20),
  timezone: NullableString(100),
  availability: z.enum(["available", "unavailable"]).nullable().optional(),
  textItems: z.array(TextItemInputSchema).max(50).nullable().optional(),
  coverImage: NullableString(2_048),
  coverImageAlt: NullableString(300),
  systemKey: z.enum(["shop"]).optional(),
  orbitPageSystemLink: z.literal("orbitpage-shop").optional(),
  position: z.number().int().nonnegative().max(ORBITPAGE_MAX_BLOCKS - 1).optional()
};

const StrictBlockInputSchema = z.object(CommonBlockShape).strict();
const LegacyBlockInputSchema = z.object(CommonBlockShape);

function legacyBlockCandidate(value: unknown) {
  if (!isPlainObject(value)) return value;
  const candidate: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(CommonBlockShape)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const parsed = (schema as z.ZodType).safeParse(value[key]);
    if (parsed.success) candidate[key] = parsed.data;
  }
  return candidate;
}

export const OrbitPageVideoContentSchema = z.object({
  mediaUrl: boundedString(2_048).optional().default(""),
  posterUrl: boundedString(2_048).optional().default(""),
  controls: z.boolean().optional().default(true),
  autoplay: z.boolean().optional().default(false),
  loop: z.boolean().optional().default(false),
  muted: z.boolean().optional().default(true),
  objectFit: z.enum(["cover", "contain"]).optional().default("cover")
}).strict();

export const OrbitPageContactContentSchema = z.object({
  name: boundedString(200).optional().default(""),
  title: boundedString(200).optional().default(""),
  role: boundedString(200).optional().default(""),
  phone: boundedString(100).optional().default(""),
  email: boundedString(320).optional().default(""),
  website: OrbitPagePublicHrefSchema.optional().default(""),
  address: boundedString(500).optional().default(""),
  note: boundedString(2_000).optional().default(""),
  whatsapp: boundedString(100).optional().default(""),
  telegram: boundedString(100).optional().default("")
}).strict();

const OrbitPageContactContentInputSchema = OrbitPageContactContentSchema.extend({
  website: OrbitPagePublicHrefInputSchema.optional().default("")
}).strict();

const SocialRowPlatformSchema = z.enum([
  "auto", "page", "link", "website", "instagram", "facebook", "tiktok", "x", "youtube",
  "linkedin", "whatsapp", "telegram", "discord", "github", "email"
]);
type SocialRowPlatform = z.infer<typeof SocialRowPlatformSchema>;

const SocialRowItemSchema = z.object({
  id: OrbitPageBlockIdSchema.optional(),
  label: boundedString(120),
  url: OrbitPagePublicHrefSchema,
  platform: SocialRowPlatformSchema.optional().default("auto"),
  icon: boundedString(24).optional().default("")
}).strict();

const SOCIAL_USERNAME_BASES: Partial<Record<SocialRowPlatform, string>> = {
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  tiktok: "https://www.tiktok.com/@",
  x: "https://x.com/",
  youtube: "https://www.youtube.com/@",
  telegram: "https://t.me/",
  github: "https://github.com/"
};

export function normalizeOrbitPageSocialHref(platform: SocialRowPlatform, value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return "";

  const existingHref = normalizeOrbitPagePublicHref(candidate);
  if (existingHref !== null) return existingHref;

  const base = SOCIAL_USERNAME_BASES[platform];
  if (base) {
    const username = candidate.replace(/^@+/, "").replace(/^\/+|\/+$/g, "");
    if (/^[a-z0-9._-]{1,100}$/i.test(username)) {
      return `${base}${username}${platform === "instagram" || platform === "facebook" ? "/" : ""}`;
    }
  }

  if (platform === "whatsapp" && /^[+\d\s().-]+$/.test(candidate)) {
    const phone = candidate.replace(/\D/g, "");
    return phone.length >= 6 && phone.length <= 15 ? `https://wa.me/${phone}` : null;
  }

  if (platform === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
    return `mailto:${candidate}`;
  }

  return null;
}

const SocialRowItemInputSchema = z.object({
  id: OrbitPageBlockIdSchema.optional(),
  label: boundedString(120),
  url: boundedString(2_048),
  platform: SocialRowPlatformSchema.optional().default("auto"),
  icon: boundedString(24).optional().default("")
}).strict().superRefine((item, context) => {
  if (normalizeOrbitPageSocialHref(item.platform, item.url) === null) {
    context.addIssue({
      code: "custom",
      path: ["url"],
      message: "Use a public URL or a valid username, phone number, or email for the selected service."
    });
  }
});

export const OrbitPageSocialRowContentSchema = z.object({
  items: z.array(SocialRowItemSchema).max(16).optional().default([]),
  layout: z.enum(["icons", "pills", "grid"]).optional().default("icons"),
  iconStyle: z.enum(["brand", "theme", "outline"]).optional().default("brand"),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional().default(3),
  boxed: z.boolean().optional().default(false),
  showTitle: z.boolean().optional().default(false),
  showLabels: z.boolean().optional().default(false)
}).strict();

const OrbitPageSocialRowContentInputSchema = OrbitPageSocialRowContentSchema.extend({
  items: z.array(SocialRowItemInputSchema).max(16).optional().default([])
}).strict();

export const OrbitPageCalloutContentSchema = z.object({
  badge: boundedString(100).optional().default(""),
  buttonLabel: boundedString(100).optional().default("")
}).strict();

export const OrbitPageMapContentSchema = z.object({
  address: boundedString(500).optional().default(""),
  placeName: boundedString(200).optional().default(""),
  mapUrl: OrbitPagePublicHrefSchema.optional().default(""),
  latitude: boundedString(40).optional().default(""),
  longitude: boundedString(40).optional().default(""),
  resolvedSource: boundedString(40).optional().default("")
}).strict();

const OrbitPageMapContentInputSchema = OrbitPageMapContentSchema.extend({
  mapUrl: OrbitPagePublicHrefInputSchema.optional().default("")
}).strict();

export const OrbitPageEventContentSchema = z.object({
  date: boundedString(20).optional().default(""),
  time: boundedString(20).optional().default(""),
  endDate: boundedString(20).optional().default(""),
  endTime: boundedString(20).optional().default(""),
  timezone: boundedString(100).optional().default(""),
  showCountdown: z.boolean().optional().default(true),
  location: boundedString(500).optional().default(""),
  ticketLabel: boundedString(100).optional().default(""),
  notes: boundedString(2_000).optional().default("")
}).strict();

export const OrbitPageEmbedContentSchema = z.object({
  snippet: boundedString(20_000).optional().default(""),
  provider: z.enum([
    "auto", "instagram", "facebook", "youtube", "spotify", "apple_music", "deezer", "soundcloud",
    "mixcloud", "vimeo", "loom", "tiktok", "giphy", "google_calendar", "calendly", "typeform",
    "google_forms", "google_maps", "newsletter", "custom"
  ]).optional().default("auto"),
  consentCategory: z.enum(["necessary", "preferences", "analytics", "marketing"]).optional().default("marketing"),
  height: z.number().int().min(120).max(1_200).optional().default(360)
}).strict();

export const OrbitPageSeparatorContentSchema = z.object({
  boxed: z.boolean().optional().default(false)
}).strict();

export const OrbitPageServiceLinkContentSchema = z.object({
  service: z.enum(["whatsapp", "github"])
}).strict();

function structuredContent(
  type: OrbitPageBlockType,
  content: unknown
): string | undefined {
  if (content === undefined || content === null || content === "") return undefined;
  if (type === "text") {
    if (typeof content !== "string") throw new Error("Text block content must be plain text.");
    return content.slice(0, 20_000);
  }

  if (["menu", "cta", "heading", "image"].includes(type)) {
    throw new Error(`${type} blocks do not support structured content.`);
  }

  const input = parseJsonObject(content, type);
  let parsed: Record<string, unknown>;
  if (type === "video") parsed = parseOrThrow(OrbitPageVideoContentSchema, input, "Invalid video block content.");
  else if (type === "contact") {
    const contact = parseOrThrow(OrbitPageContactContentInputSchema, input, "Invalid contact block content.");
    parsed = parseOrThrow(OrbitPageContactContentSchema, {
      ...contact,
      website: normalizeOrbitPagePublicHref(contact.website) ?? contact.website
    }, "Invalid contact block content.");
  }
  else if (type === "social_row") {
    const socialRow = parseOrThrow(OrbitPageSocialRowContentInputSchema, input, "Invalid social-row block content.");
    parsed = parseOrThrow(OrbitPageSocialRowContentSchema, {
      ...socialRow,
      items: socialRow.items.map((item) => ({
        ...item,
        url: normalizeOrbitPageSocialHref(item.platform, item.url) ?? item.url
      }))
    }, "Invalid social-row block content.");
  }
  else if (type === "callout") parsed = parseOrThrow(OrbitPageCalloutContentSchema, input, "Invalid callout block content.");
  else if (type === "map") {
    const map = parseOrThrow(OrbitPageMapContentInputSchema, input, "Invalid map block content.");
    parsed = parseOrThrow(OrbitPageMapContentSchema, {
      ...map,
      mapUrl: normalizeOrbitPagePublicHref(map.mapUrl) ?? map.mapUrl
    }, "Invalid map block content.");
  }
  else if (type === "event") parsed = parseOrThrow(OrbitPageEventContentSchema, input, "Invalid event block content.");
  else if (type === "embed") parsed = parseOrThrow(OrbitPageEmbedContentSchema, input, "Invalid embed block content.");
  else if (type === "separator") parsed = parseOrThrow(OrbitPageSeparatorContentSchema, input, "Invalid separator block content.");
  else if (type === "link") {
    if ("items" in input) {
      const socialRow = parseOrThrow(
        OrbitPageSocialRowContentInputSchema,
        input,
        "Invalid legacy social-row block content."
      );
      parsed = parseOrThrow(OrbitPageSocialRowContentSchema, {
        ...socialRow,
        items: socialRow.items.map((item) => ({
          ...item,
          url: normalizeOrbitPageSocialHref(item.platform, item.url) ?? item.url
        }))
      }, "Invalid legacy social-row block content.");
    } else {
      parsed = parseOrThrow(OrbitPageServiceLinkContentSchema, input, "Invalid service-link block content.");
    }
  } else {
    throw new Error(`Unsupported block type: ${type}`);
  }
  return stableJsonObject(parsed);
}

function canonicalBlockHref(type: OrbitPageBlockType, content: string | undefined, value: string | null | undefined) {
  const candidate = value ?? "";
  const normalized = normalizeOrbitPagePublicHref(candidate);
  if (normalized !== null) return normalized;

  if (type === "link" && content) {
    const serviceResult = OrbitPageServiceLinkContentSchema.safeParse(parseJsonObject(content, "link"));
    if (serviceResult.success) {
      const serviceHref = normalizeOrbitPageSocialHref(serviceResult.data.service, candidate);
      if (serviceHref !== null) return serviceHref;
    }
  }

  return candidate;
}

export const OrbitPageBlockSchema = z.object({
  id: OrbitPageBlockIdSchema,
  title: boundedString(200),
  description: boundedString(2_000),
  url: OrbitPagePublicHrefSchema,
  hideUrl: z.boolean().optional(),
  type: OrbitPageBlockTypeSchema,
  icon: boundedString(2_048).nullable().optional(),
  iconType: z.enum(["emoji", "image", "svg"]).nullable().optional(),
  backgroundColor: NullableHex,
  textColor: NullableHex,
  surfaceEffect: SurfaceEffectSchema,
  titleFontSize: NullableString(40),
  titleFontFamily: NullableString(200),
  descriptionFontSize: NullableString(40),
  descriptionFontFamily: NullableString(200),
  alignment: z.enum(["left", "center", "right"]).nullable().optional(),
  size: z.enum(["small", "medium", "large"]).nullable().optional(),
  content: boundedString(20_000).nullable().optional(),
  isActive: z.boolean(),
  clickCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ctaAction: z.enum(["book", "contact", "download", "subscribe", "buy"]).nullable().optional(),
  ctaClicks: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  status: z.enum(["draft", "live", "expired"]),
  campaignName: NullableString(120),
  startDate: NullableString(20),
  startTime: NullableString(20),
  endDate: NullableString(20),
  endTime: NullableString(20),
  timezone: NullableString(100),
  availability: z.enum(["available", "unavailable"]),
  textItems: z.array(TextItemSchema).max(50).nullable().optional(),
  coverImage: NullableString(2_048),
  coverImageAlt: NullableString(300),
  systemKey: z.enum(["shop"]).optional(),
  position: z.number().int().nonnegative().max(ORBITPAGE_MAX_BLOCKS - 1)
}).strict();

export type OrbitPageBlock = z.infer<typeof OrbitPageBlockSchema>;

function canonicalBlock(value: unknown, position: number, strict: boolean): OrbitPageBlock {
  const input = parseOrThrow(
    strict ? StrictBlockInputSchema : LegacyBlockInputSchema,
    strict ? value : legacyBlockCandidate(value),
    "A page block contains invalid or unsupported data."
  );
  const requestedType = typeof input.type === "string" ? input.type : "link";
  const type = ORBITPAGE_BLOCK_TYPES.includes(requestedType as OrbitPageBlockType)
    ? requestedType as OrbitPageBlockType
    : strict
      ? (() => { throw new Error(`Unsupported block type: ${requestedType}`); })()
      : "link";
  const requestedId = String(input.id ?? "");
  const id = OrbitPageBlockIdSchema.safeParse(requestedId).success ? requestedId : generatedId();
  const content = structuredContent(type, input.content);
  const textItems = input.textItems?.map((item) => ({
    ...item,
    ...(item.url !== undefined && item.url !== null
      ? { url: normalizeOrbitPagePublicHref(item.url) ?? item.url }
      : {})
  }));

  return parseOrThrow(OrbitPageBlockSchema, {
    id,
    title: input.title ?? "",
    description: input.description ?? "",
    url: canonicalBlockHref(type, content, input.url),
    ...(input.hideUrl !== undefined && input.hideUrl !== null ? { hideUrl: input.hideUrl } : {}),
    type,
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.iconType !== undefined || input.icon_type !== undefined
      ? { iconType: input.iconType ?? input.icon_type }
      : {}),
    ...(input.backgroundColor !== undefined ? { backgroundColor: input.backgroundColor } : {}),
    ...(input.textColor !== undefined ? { textColor: input.textColor } : {}),
    ...(input.surfaceEffect !== undefined ? { surfaceEffect: input.surfaceEffect } : {}),
    ...(input.titleFontSize !== undefined ? { titleFontSize: input.titleFontSize } : {}),
    ...(input.titleFontFamily !== undefined || input.titleFont !== undefined
      ? { titleFontFamily: input.titleFontFamily ?? input.titleFont }
      : {}),
    ...(input.descriptionFontSize !== undefined ? { descriptionFontSize: input.descriptionFontSize } : {}),
    ...(input.descriptionFontFamily !== undefined ? { descriptionFontFamily: input.descriptionFontFamily } : {}),
    ...(input.alignment !== undefined ? { alignment: input.alignment } : {}),
    ...(input.size !== undefined ? { size: input.size } : {}),
    ...(content !== undefined ? { content } : {}),
    isActive: input.isActive !== false,
    clickCount: input.clickCount ?? 0,
    ...(type === "cta" && input.ctaAction !== undefined ? { ctaAction: input.ctaAction } : {}),
    ...(type === "cta" ? { ctaClicks: input.ctaClicks ?? 0 } : {}),
    status: input.status ?? "live",
    ...(input.campaignName !== undefined ? { campaignName: input.campaignName } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    availability: input.availability ?? "available",
    ...(type === "text" && textItems !== undefined ? { textItems } : {}),
    ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
    ...(input.coverImageAlt !== undefined ? { coverImageAlt: input.coverImageAlt } : {}),
    ...(input.systemKey !== undefined || input.orbitPageSystemLink === "orbitpage-shop"
      ? { systemKey: input.systemKey ?? "shop" }
      : {}),
    position
  }, "A page block contains invalid or unsupported data.");
}

function assertUniqueIds(blocks: OrbitPageBlock[]) {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (ids.has(block.id)) throw new Error(`Block IDs must be unique: ${block.id}`);
    ids.add(block.id);
  }
  return blocks;
}

export const OrbitPageBlocksSchema = z.array(OrbitPageBlockSchema).max(ORBITPAGE_MAX_BLOCKS)
  .superRefine((blocks, context) => {
    const ids = new Set<string>();
    blocks.forEach((block, index) => {
      if (ids.has(block.id)) {
        context.addIssue({ code: "custom", path: [index, "id"], message: "Block IDs must be unique." });
      }
      ids.add(block.id);
      if (block.position !== index) {
        context.addIssue({ code: "custom", path: [index, "position"], message: "Block positions must match their order." });
      }
    });
  });

export function parseOrbitPageBlocks(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Blocks must be provided as a list.");
  if (value.length > ORBITPAGE_MAX_BLOCKS) throw new Error(`A page cannot contain more than ${ORBITPAGE_MAX_BLOCKS} blocks.`);
  return assertUniqueIds(value.map((block, index) => canonicalBlock(block, index, true)));
}

export function normalizeStoredOrbitPageBlocks(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > ORBITPAGE_MAX_BLOCKS) throw new Error(`A page cannot contain more than ${ORBITPAGE_MAX_BLOCKS} blocks.`);
  const ids = new Set<string>();
  return value.map((block, index) => {
    const normalized = canonicalBlock(block, index, false);
    if (!ids.has(normalized.id)) {
      ids.add(normalized.id);
      return normalized;
    }
    const id = generatedId();
    ids.add(id);
    return { ...normalized, id };
  });
}

export const OrbitPageBlockStylePatchSchema = z.object({
  backgroundColor: NullableHex,
  textColor: NullableHex,
  surfaceEffect: SurfaceEffectSchema,
  titleFontFamily: NullableString(200),
  descriptionFontFamily: NullableString(200),
  alignment: z.enum(["left", "center", "right"]).nullable().optional(),
  titleFontSize: NullableString(40),
  descriptionFontSize: NullableString(40),
  size: z.enum(["small", "medium", "large"]).nullable().optional()
}).strict();

export const OrbitPageBlockMediaPatchSchema = z.object({
  icon: NullableString(2_048),
  iconType: z.enum(["emoji", "image", "svg"]).nullable().optional(),
  coverImage: NullableString(2_048),
  coverImageAlt: NullableString(300)
}).strict();

export function parseOrbitPageBlockStylePatch(value: unknown) {
  return parseOrThrow(OrbitPageBlockStylePatchSchema, value, "The block style patch contains unsupported fields.");
}

export function parseOrbitPageBlockMediaPatch(value: unknown) {
  return parseOrThrow(OrbitPageBlockMediaPatchSchema, value, "The block media patch contains unsupported fields.");
}

export function parseStructuredBlockContent(block: Pick<OrbitPageBlock, "type" | "content">) {
  if (!block.content) return null;
  if (block.type === "text") return block.content;
  const parsed: unknown = JSON.parse(block.content);
  return isPlainObject(parsed) ? parsed : null;
}

export const ORBITPAGE_BLOCK_CAPABILITIES = [
  { type: "link", contentKind: "structured", contentSchema: "serviceLink", supportsUrl: true },
  { type: "menu", contentKind: "none", supportsUrl: true },
  { type: "text", contentKind: "text", supportsUrl: true },
  { type: "separator", contentKind: "structured", contentSchema: "separator", supportsUrl: false },
  { type: "cta", contentKind: "none", supportsUrl: true },
  { type: "heading", contentKind: "none", supportsUrl: false },
  { type: "image", contentKind: "none", supportsUrl: true, supportsCoverImage: true },
  { type: "video", contentKind: "structured", contentSchema: "video", supportsUrl: false },
  { type: "contact", contentKind: "structured", contentSchema: "contact", supportsUrl: true },
  { type: "social_row", contentKind: "structured", contentSchema: "socialRow", supportsUrl: false },
  { type: "callout", contentKind: "structured", contentSchema: "callout", supportsUrl: true },
  { type: "map", contentKind: "structured", contentSchema: "map", supportsUrl: true },
  { type: "event", contentKind: "structured", contentSchema: "event", supportsUrl: true },
  { type: "embed", contentKind: "structured", contentSchema: "embed", supportsUrl: false }
] as const;

export const OrbitPageStructuredBlockContentJsonSchemas = {
  serviceLink: z.toJSONSchema(OrbitPageServiceLinkContentSchema, { target: "draft-2020-12" }),
  video: z.toJSONSchema(OrbitPageVideoContentSchema, { target: "draft-2020-12" }),
  contact: z.toJSONSchema(OrbitPageContactContentSchema, { target: "draft-2020-12" }),
  socialRow: z.toJSONSchema(OrbitPageSocialRowContentSchema, { target: "draft-2020-12" }),
  callout: z.toJSONSchema(OrbitPageCalloutContentSchema, { target: "draft-2020-12" }),
  map: z.toJSONSchema(OrbitPageMapContentSchema, { target: "draft-2020-12" }),
  event: z.toJSONSchema(OrbitPageEventContentSchema, { target: "draft-2020-12" }),
  embed: z.toJSONSchema(OrbitPageEmbedContentSchema, { target: "draft-2020-12" }),
  separator: z.toJSONSchema(OrbitPageSeparatorContentSchema, { target: "draft-2020-12" })
} as const;
