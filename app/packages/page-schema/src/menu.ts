import { z } from "zod";
import {
  OrbitPageBlockIdSchema,
  OrbitPageHexColorSchema,
  boundedString,
  parseOrThrow
} from "./primitives";

const MenuVariantSchema = z.object({
  id: OrbitPageBlockIdSchema,
  name: boundedString(60).trim().min(1),
  priceMinor: z.number().int().min(0).max(10_000_000)
}).strict();

const MenuSectionSchema = z.object({
  id: OrbitPageBlockIdSchema,
  parentId: OrbitPageBlockIdSchema.optional(),
  name: boundedString(80).trim().min(1),
  description: boundedString(240).trim().optional(),
  visible: z.boolean(),
  position: z.number().int().min(0).max(29)
}).strict();

const MenuItemSchema = z.object({
  id: OrbitPageBlockIdSchema,
  sectionId: OrbitPageBlockIdSchema,
  name: boundedString(120).trim().min(1),
  description: boundedString(500).trim().optional(),
  priceMinor: z.number().int().min(0).max(10_000_000),
  details: boundedString(100).trim().optional(),
  imageUrl: boundedString(2_048).trim().optional(),
  imageAlt: boundedString(160).trim().optional(),
  variants: z.array(MenuVariantSchema).max(8),
  allergens: z.array(boundedString(40).trim().min(1)).max(20),
  dietaryTags: z.array(boundedString(40).trim().min(1)).max(12),
  available: z.boolean(),
  featured: z.boolean(),
  position: z.number().int().min(0).max(249)
}).strict();

export const OrbitPageMenuThemeSchema = z.object({
  preset: z.enum(["editorial", "bistro", "espresso", "coastal"]),
  background: OrbitPageHexColorSchema,
  surface: OrbitPageHexColorSchema,
  text: OrbitPageHexColorSchema,
  muted: OrbitPageHexColorSchema,
  accent: OrbitPageHexColorSchema,
  border: OrbitPageHexColorSchema,
  radius: z.number().int().min(0).max(28),
  imageLayout: z.enum(["compact", "cover"])
}).strict();

export const ORBITPAGE_CONTENT_DESTINATIONS = ["link", "menu", "shop", "pages"] as const;

export const OrbitPageContentRoutingSchema = z.object({
  homepage: z.enum(ORBITPAGE_CONTENT_DESTINATIONS),
  homepagePageSlug: boundedString(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  linkEnabled: z.boolean()
}).strict();

export type OrbitPageContentRouting = z.infer<typeof OrbitPageContentRoutingSchema>;

export const DEFAULT_ORBITPAGE_CONTENT_ROUTING: OrbitPageContentRouting = {
  homepage: "link",
  linkEnabled: true
};

export const OrbitPageMenuSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  venueType: z.enum(["restaurant", "bar", "cafe"]),
  name: boundedString(120).trim().min(1),
  description: boundedString(500).trim(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  sections: z.array(MenuSectionSchema).min(1).max(30),
  items: z.array(MenuItemSchema).max(250),
  theme: OrbitPageMenuThemeSchema,
  routing: OrbitPageContentRoutingSchema.default(DEFAULT_ORBITPAGE_CONTENT_ROUTING),
  updatedAt: z.string().datetime().optional()
}).strict().superRefine((menu, context) => {
  const sectionIds = new Set(menu.sections.map((section) => section.id));
  if (sectionIds.size !== menu.sections.length) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Menu section IDs must be unique." });
  }
  const sectionById = new Map(menu.sections.map((section) => [section.id, section]));
  menu.sections.forEach((section, index) => {
    if (!section.parentId) return;
    const parent = sectionById.get(section.parentId);
    if (!parent || parent.id === section.id) {
      context.addIssue({ code: "custom", path: ["sections", index, "parentId"], message: "Menu subsection references an unknown parent." });
    } else if (parent.parentId) {
      context.addIssue({ code: "custom", path: ["sections", index, "parentId"], message: "Menu subsections support one nesting level." });
    }
  });
  const itemIds = new Set(menu.items.map((item) => item.id));
  if (itemIds.size !== menu.items.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Menu item IDs must be unique." });
  }
  menu.items.forEach((item, index) => {
    if (!sectionIds.has(item.sectionId)) {
      context.addIssue({ code: "custom", path: ["items", index, "sectionId"], message: "Menu item references an unknown section." });
    }
  });
});

export type OrbitPageMenu = z.infer<typeof OrbitPageMenuSchema>;

export const DEFAULT_ORBITPAGE_MENU: OrbitPageMenu = {
  version: 1,
  enabled: false,
  venueType: "restaurant",
  name: "Our menu",
  description: "A concise selection, updated by the venue.",
  currency: "EUR",
  locale: "en-GB",
  sections: [
    { id: "section-1", name: "Starters", description: "Small plates and seasonal openings", visible: true, position: 0 },
    { id: "section-2", name: "Main courses", description: "From the kitchen", visible: true, position: 1 },
    { id: "section-3", name: "Desserts", description: "A final course", visible: true, position: 2 }
  ],
  items: [],
  theme: {
    preset: "editorial",
    background: "#f4f1eb",
    surface: "#fffdf8",
    text: "#17201d",
    muted: "#66706b",
    accent: "#1f5b47",
    border: "#d7d4cc",
    radius: 8,
    imageLayout: "compact"
  },
  routing: DEFAULT_ORBITPAGE_CONTENT_ROUTING
};

export function parseOrbitPageMenu(value: unknown) {
  return parseOrThrow(OrbitPageMenuSchema, value ?? DEFAULT_ORBITPAGE_MENU, "The menu contains invalid or unsupported data.");
}
