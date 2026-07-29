import {
  normalizeStoredOrbitPageBlocks,
  type OrbitPageBlock
} from '@orbitpage/page-schema';
import type { LinkData } from '@/components/LinkCard';

const emptyToUndefined = (value: string | null | undefined) => value || undefined;

function toLinkData(link: OrbitPageBlock): LinkData {
  return {
    id: link.id,
    title: link.title,
    description: link.description,
    url: link.url,
    hideUrl: link.hideUrl === true,
    type: link.type,
    icon: emptyToUndefined(link.icon),
    iconType: link.iconType || undefined,
    backgroundColor: emptyToUndefined(link.backgroundColor),
    textColor: emptyToUndefined(link.textColor),
    surfaceEffect: link.surfaceEffect || undefined,
    size: link.size || undefined,
    content: emptyToUndefined(link.content),
    textItems: link.textItems?.map((item) => ({
      text: item.text,
      url: emptyToUndefined(item.url),
      textColor: emptyToUndefined(item.textColor),
      fontSize: emptyToUndefined(item.fontSize),
      fontFamily: emptyToUndefined(item.fontFamily),
    })),
    titleFontFamily: emptyToUndefined(link.titleFontFamily),
    descriptionFontFamily: emptyToUndefined(link.descriptionFontFamily),
    alignment: link.alignment || undefined,
    titleFontSize: emptyToUndefined(link.titleFontSize),
    descriptionFontSize: emptyToUndefined(link.descriptionFontSize),
    isActive: link.isActive,
    clickCount: link.clickCount,
    ...(link.type === 'cta'
      ? { ctaAction: link.ctaAction || undefined, ctaClicks: link.ctaClicks || 0 }
      : {}),
    status: link.status,
    campaignName: emptyToUndefined(link.campaignName),
    startDate: emptyToUndefined(link.startDate),
    startTime: emptyToUndefined(link.startTime),
    endDate: emptyToUndefined(link.endDate),
    endTime: emptyToUndefined(link.endTime),
    timezone: emptyToUndefined(link.timezone),
    availability: link.availability,
    coverImage: emptyToUndefined(link.coverImage),
    coverImageAlt: emptyToUndefined(link.coverImageAlt),
    systemKey: link.systemKey,
  };
}

export function normalizeLinkDto(input: unknown): LinkData {
  const [link] = normalizeStoredOrbitPageBlocks([input]);
  if (!link) throw new Error('The link payload is invalid.');
  return toLinkData(link);
}

export function normalizeLinkDtos(input: unknown): LinkData[] {
  return normalizeStoredOrbitPageBlocks(input).map(toLinkData);
}
