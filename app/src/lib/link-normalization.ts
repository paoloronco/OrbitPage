import { z } from 'zod';
import type { LinkData } from '@/components/LinkCard';

const optionalString = z.string().nullish();
const optionalNumber = z.number().int().nonnegative().nullish();
const linkTypeSchema = z.enum(['link', 'text', 'separator', 'cta']).catch('link');
const iconTypeSchema = z.enum(['emoji', 'image', 'svg']).optional().catch(undefined);
const alignmentSchema = z.enum(['left', 'center', 'right']).optional().catch(undefined);
const sizeSchema = z.enum(['small', 'medium', 'large']).optional().catch(undefined);
const statusSchema = z.enum(['draft', 'live', 'expired']).optional().catch('live');
const ctaActionSchema = z.enum(['book', 'contact', 'download', 'subscribe', 'buy']).optional().catch(undefined);

const textItemSchema = z.object({
  text: z.string(),
  url: optionalString,
  textColor: optionalString,
  fontSize: optionalString,
  fontFamily: optionalString,
});

const linkDtoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().catch(''),
  description: optionalString,
  url: optionalString,
  type: linkTypeSchema.optional(),
  icon: optionalString,
  iconType: iconTypeSchema,
  icon_type: iconTypeSchema,
  backgroundColor: optionalString,
  textColor: optionalString,
  size: sizeSchema,
  content: optionalString,
  textItems: z.array(textItemSchema).nullish(),
  isActive: z.boolean().nullish(),
  clickCount: optionalNumber,
  ctaAction: ctaActionSchema,
  ctaClicks: optionalNumber,
  status: statusSchema,
  campaignName: optionalString,
  startDate: optionalString,
  startTime: optionalString,
  endDate: optionalString,
  endTime: optionalString,
  timezone: optionalString,
  titleFont: optionalString,
  titleFontFamily: optionalString,
  descriptionFontFamily: optionalString,
  titleFontSize: optionalString,
  descriptionFontSize: optionalString,
  alignment: alignmentSchema,
  coverImage: optionalString,
  coverImageAlt: optionalString,
}).passthrough();

const emptyToUndefined = (value: string | null | undefined) => value || undefined;

export function normalizeLinkDto(input: unknown): LinkData {
  const link = linkDtoSchema.parse(input);
  const type = link.type || 'link';

  return {
    id: String(link.id),
    title: link.title,
    description: link.description || '',
    url: link.url || '',
    type,
    icon: emptyToUndefined(link.icon),
    iconType: link.iconType || link.icon_type || undefined,
    backgroundColor: emptyToUndefined(link.backgroundColor),
    textColor: emptyToUndefined(link.textColor),
    size: link.size,
    content: emptyToUndefined(link.content),
    textItems: link.textItems || undefined,
    titleFontFamily: emptyToUndefined(link.titleFontFamily || link.titleFont),
    descriptionFontFamily: emptyToUndefined(link.descriptionFontFamily),
    alignment: link.alignment,
    titleFontSize: emptyToUndefined(link.titleFontSize),
    descriptionFontSize: emptyToUndefined(link.descriptionFontSize),
    isActive: link.isActive !== false,
    clickCount: link.clickCount || 0,
    ...(type === 'cta' ? { ctaAction: link.ctaAction, ctaClicks: link.ctaClicks || 0 } : {}),
    status: link.status || 'live',
    campaignName: emptyToUndefined(link.campaignName),
    startDate: emptyToUndefined(link.startDate),
    startTime: emptyToUndefined(link.startTime),
    endDate: emptyToUndefined(link.endDate),
    endTime: emptyToUndefined(link.endTime),
    timezone: emptyToUndefined(link.timezone),
    coverImage: emptyToUndefined(link.coverImage),
    coverImageAlt: emptyToUndefined(link.coverImageAlt),
  };
}

export function normalizeLinkDtos(input: unknown): LinkData[] {
  if (!Array.isArray(input)) return [];
  return input.map(normalizeLinkDto);
}
