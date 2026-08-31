import { z } from 'zod';

const InternalLinksContentSchema = z.object({
  items: z.array(z.object({
    id: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    kind: z.enum(['link', 'menu', 'shop', 'page']),
    path: z.string().max(100).regex(/^\/(?:links|menu|shop|[a-z0-9]+(?:-[a-z0-9]+)*)$/),
    label: z.string().max(120).optional().default(''),
    description: z.string().max(300).optional().default(''),
    icon: z.string().max(24).optional().default(''),
  }).strict()).max(12).optional().default([]),
  layout: z.enum(['stacked', 'grid', 'buttons']).optional().default('stacked'),
  columns: z.union([z.literal(2), z.literal(3)]).optional().default(2),
  itemStyle: z.enum(['filled', 'outline', 'minimal']).optional().default('filled'),
  showDescriptions: z.boolean().optional().default(true),
  showIcons: z.boolean().optional().default(true),
}).strict();

// Validation schema for a single link — used by import and PUT /api/links.
export const LinkSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().nonnegative()]),
  title: z.string().max(500),
  description: z.string().max(2000).optional().default(''),
  url: z.string().max(5000).optional().default(''),
  hideUrl: z.boolean().optional(),
  // Accept any string: data:image/ base64, http(s)/blob URLs, or short emoji/text strings.
  icon: z.string().max(2000000).nullable().optional().default(null),
  type: z.string().min(1).max(50).optional().default('link'),
  iconType: z.union([
    z.string().max(50),
    z.object({
      type: z.string().max(50),
    }).transform((obj) => obj.type),
  ]).nullable().optional(),
  textItems: z.array(
    z.union([
      z.string().max(1000),
      z.object({
        text: z.string().max(1000),
        url: z.string().max(5000).optional(),
        textColor: z.string().max(100).nullable().optional(),
        fontSize: z.string().max(50).nullable().optional(),
        fontFamily: z.string().max(200).nullable().optional(),
      }),
    ]),
  ).nullable().optional(),
  backgroundColor: z.string().max(100).nullable().optional(),
  textColor: z.string().max(100).nullable().optional(),
  surfaceEffect: z.enum(['inherit', 'solid', 'transparent', 'liquid-glass']).nullable().optional(),
  titleFontSize: z.string().max(50).nullable().optional(),
  descriptionFontSize: z.string().max(50).nullable().optional(),
  titleFontFamily: z.string().max(200).nullable().optional(),
  descriptionFontFamily: z.string().max(200).nullable().optional(),
  alignment: z.enum(['left', 'center', 'right']).nullable().optional(),
  size: z.string().max(50).nullable().optional(),
  content: z.string().max(100000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().nullable().optional(),
  status: z.enum(['draft', 'live', 'expired']).nullable().optional().default('live'),
  ctaAction: z.enum(['book', 'contact', 'download', 'subscribe', 'buy']).nullable().optional(),
  ctaClicks: z.number().int().nonnegative().nullable().optional(),
  campaignName: z.string().max(200).nullable().optional(),
  startDate: z.string().max(10).nullable().optional(),
  endDate: z.string().max(10).nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  availability: z.enum(['available', 'unavailable']).optional().default('available'),
  // clickCount is preserved on import so analytics survive a round-trip export/import.
  clickCount: z.number().int().nonnegative().nullable().optional(),
  coverImage: z.string().max(5000000).nullable().optional(),
  coverImageAlt: z.string().max(500).nullable().optional(),
}).strip().superRefine((link, context) => {
  if (link.type !== 'social_row' && link.type !== 'internal_links' && !link.title.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['title'],
      message: 'Title is required for this block type.',
    });
  }
  if (link.type === 'internal_links') {
    let parsed;
    try {
      parsed = JSON.parse(link.content || '{}');
    } catch {
      parsed = null;
    }
    const result = InternalLinksContentSchema.safeParse(parsed);
    if (!result.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content'],
        message: 'Internal navigation contains invalid or unsafe destinations.',
      });
    }
  }
});

export const LinksPayloadSchema = z.array(LinkSchema).max(200);
