import { z } from 'zod';

const Text = (max) => z.string().trim().max(max);
const Id = z.string().trim().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i);

const MenuVariantSchema = z.object({
  id: Id,
  name: Text(60).min(1),
  priceMinor: z.number().int().min(0).max(10_000_000),
}).strict();

const MenuSectionSchema = z.object({
  id: Id,
  name: Text(80).min(1),
  description: Text(240).optional(),
  visible: z.boolean(),
  position: z.number().int().min(0).max(29),
}).strict();

const MenuItemSchema = z.object({
  id: Id,
  sectionId: Id,
  name: Text(120).min(1),
  description: Text(500).optional(),
  priceMinor: z.number().int().min(0).max(10_000_000),
  details: Text(100).optional(),
  imageUrl: Text(2048).optional(),
  imageAlt: Text(160).optional(),
  variants: z.array(MenuVariantSchema).max(8),
  allergens: z.array(Text(40).min(1)).max(20),
  dietaryTags: z.array(Text(40).min(1)).max(12),
  available: z.boolean(),
  featured: z.boolean(),
  position: z.number().int().min(0).max(249),
}).strict();

export const MenuCatalogSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  venueType: z.enum(['restaurant', 'bar', 'cafe']),
  name: Text(120).min(1),
  description: Text(500),
  currency: z.string().regex(/^[A-Z]{3}$/),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  sections: z.array(MenuSectionSchema).min(1).max(30),
  items: z.array(MenuItemSchema).max(250),
  theme: z.object({
    preset: z.enum(['editorial', 'bistro', 'espresso', 'coastal']),
    background: Hex,
    surface: Hex,
    text: Hex,
    muted: Hex,
    accent: Hex,
    border: Hex,
    radius: z.number().int().min(0).max(28),
    imageLayout: z.enum(['compact', 'cover']),
  }).strict(),
  updatedAt: z.string().datetime().optional(),
}).strict().superRefine((menu, context) => {
  const sectionIds = new Set(menu.sections.map((section) => section.id));
  if (sectionIds.size !== menu.sections.length) context.addIssue({ code: 'custom', path: ['sections'], message: 'Section IDs must be unique' });
  if (new Set(menu.items.map((item) => item.id)).size !== menu.items.length) context.addIssue({ code: 'custom', path: ['items'], message: 'Product IDs must be unique' });
  menu.items.forEach((item, index) => {
    if (!sectionIds.has(item.sectionId)) context.addIssue({ code: 'custom', path: ['items', index, 'sectionId'], message: 'Unknown menu section' });
  });
});

export const DEFAULT_MENU_CATALOG = {
  version: 1,
  enabled: false,
  venueType: 'restaurant',
  name: 'Our menu',
  description: 'A concise selection, updated by the venue.',
  currency: 'EUR',
  locale: 'en-GB',
  sections: [
    { id: 'section-1', name: 'Starters', description: 'Small plates and seasonal openings', visible: true, position: 0 },
    { id: 'section-2', name: 'Main courses', description: 'From the kitchen', visible: true, position: 1 },
    { id: 'section-3', name: 'Desserts', description: 'A final course', visible: true, position: 2 },
  ],
  items: [],
  theme: { preset: 'editorial', background: '#f4f1eb', surface: '#fffdf8', text: '#17201d', muted: '#66706b', accent: '#1f5b47', border: '#d7d4cc', radius: 8, imageLayout: 'compact' },
};

export function parseMenuCatalog(value) {
  const result = MenuCatalogSchema.safeParse(value || DEFAULT_MENU_CATALOG);
  if (!result.success) throw new Error(result.error.issues[0]?.message || 'Invalid menu data');
  return result.data;
}
