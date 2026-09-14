import { z } from "zod";
import { OrbitPageIsoDateSchema, boundedString } from "./primitives";

const CAMPAIGN_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const CAMPAIGN_DESTINATION_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?)(?:\?section=[a-zA-Z0-9_-]{1,80})?$/;
const CAMPAIGN_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const OrbitPageCampaignDestinationSchema = boundedString(160).trim().refine(
  (value) => value === "" || CAMPAIGN_DESTINATION_PATTERN.test(value),
  "Use a page, menu or menu section from this OrbitPage."
);

export const OrbitPageCampaignRuleSchema = z.object({
  label: boundedString(48).trim().min(1),
  destination: OrbitPageCampaignDestinationSchema,
  startTime: z.string().regex(CAMPAIGN_TIME_PATTERN),
  endTime: z.string().regex(CAMPAIGN_TIME_PATTERN),
  enabled: z.boolean()
}).strict();

export const OrbitPageCampaignLinkSchema = z.object({
  slug: z.string().regex(CAMPAIGN_SLUG_PATTERN),
  label: boundedString(80).trim().min(1),
  destination: OrbitPageCampaignDestinationSchema,
  timezone: boundedString(80).trim().min(1).refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Use a valid IANA timezone."),
  enabled: z.boolean(),
  rules: z.array(OrbitPageCampaignRuleSchema).max(4)
}).strict();

export const OrbitPageCampaignLinksSchema = z.array(OrbitPageCampaignLinkSchema).max(20)
  .superRefine((links, context) => {
    const slugs = new Set<string>();
    links.forEach((link, index) => {
      if (slugs.has(link.slug)) context.addIssue({ code: "custom", path: [index, "slug"], message: "Campaign slugs must be unique." });
      slugs.add(link.slug);
    });
  });

export type OrbitPageCampaignLink = z.infer<typeof OrbitPageCampaignLinkSchema>;
export type OrbitPageCampaignRule = z.infer<typeof OrbitPageCampaignRuleSchema>;

export function parseOrbitPageCampaignLinks(value: unknown) {
  return OrbitPageCampaignLinksSchema.parse(value);
}

export const OrbitPageTextFileSchema = z.object({
  key: boundedString(160).trim().min(1),
  path: boundedString(100).trim().min(1),
  content: boundedString(50_001),
  isCustom: z.boolean(),
  createdAt: OrbitPageIsoDateSchema,
  updatedAt: OrbitPageIsoDateSchema
}).strict();

export const OrbitPageTextFilesSchema = z.array(OrbitPageTextFileSchema).max(25);

export const OrbitPageSitemapSchema = z.object({
  generatedAt: OrbitPageIsoDateSchema
}).strict();

export type OrbitPageTextFile = z.infer<typeof OrbitPageTextFileSchema>;
export type OrbitPageSitemap = z.infer<typeof OrbitPageSitemapSchema>;
