import { z } from 'zod';

// Validation schema for a single link — used by import and PUT /api/links.
export const LinkSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().nonnegative()]),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  url: z.string().max(5000).optional().default(''),
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
  titleFontSize: z.string().max(50).nullable().optional(),
  descriptionFontSize: z.string().max(50).nullable().optional(),
  titleFontFamily: z.string().max(200).nullable().optional(),
  descriptionFontFamily: z.string().max(200).nullable().optional(),
  alignment: z.enum(['left', 'center', 'right']).nullable().optional(),
  size: z.string().max(50).nullable().optional(),
  content: z.string().max(10000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().nullable().optional(),
  startDate: z.string().max(10).nullable().optional(),
  endDate: z.string().max(10).nullable().optional(),
  // clickCount is preserved on import so analytics survive a round-trip export/import.
  clickCount: z.number().int().nonnegative().nullable().optional(),
  coverImage: z.string().max(5000000).nullable().optional(),
  coverImageAlt: z.string().max(500).nullable().optional(),
}).strip();

export const LinksPayloadSchema = z.array(LinkSchema).max(200);
