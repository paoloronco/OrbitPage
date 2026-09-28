import type { LinkData } from './LinkCard';
import { mapPreviewApi } from '@/lib/api-client';
import { buildBlockContent, getInternalLinksData, getMapData, isSocialRowContent } from '@/lib/link-blocks';
import { isNativeMenuLink } from '@/lib/native-menu-link';
import { extractMapCoordinates, getMapQuery, getMapResolutionSource, toMapCoordinates } from '@/lib/map-location';

type SaveResult = {
  saved: boolean;
  isDirty: boolean;
  error: string;
};

const getSaveErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? error.message
    : 'Changes could not be saved. Try again.';

export async function prepareLinkForSave(link: LinkData): Promise<LinkData> {
  let normalized = isNativeMenuLink(link) ? { ...link, type: 'menu' as const, hideUrl: true } : link;

  if (normalized.type === 'map') {
    const data = getMapData(normalized.content);
    const placeName = data.placeName?.trim();
    const address = data.address?.trim();
    const mapUrl = data.mapUrl?.trim();
    const source = getMapResolutionSource(placeName, address, mapUrl);
    const existing = data.resolvedSource === source ? toMapCoordinates(data.latitude, data.longitude) : null;
    const direct = extractMapCoordinates(mapUrl)
      || extractMapCoordinates(address)
      || extractMapCoordinates(placeName);
    const query = getMapQuery(placeName, address, normalized.title && normalized.title !== 'Map' ? normalized.title : '', mapUrl);
    let coordinates = direct || existing;
    if (!coordinates && (query || mapUrl)) {
      const resolved = await mapPreviewApi.resolve(query, mapUrl);
      coordinates = toMapCoordinates(resolved.lat, resolved.lon);
      if (!coordinates) throw new Error('The map provider returned invalid coordinates.');
    }
    normalized = {
      ...normalized,
      url: '',
      hideUrl: true,
      content: buildBlockContent({
        ...data,
        placeName,
        address,
        mapUrl,
        latitude: coordinates ? String(coordinates.lat) : undefined,
        longitude: coordinates ? String(coordinates.lon) : undefined,
        resolvedSource: coordinates ? source : undefined,
      }),
    };
  }

  if (link.type === 'social_row' || (link.type !== 'internal_links' && isSocialRowContent(link.content))) {
    return { ...normalized, type: 'social_row', title: '', description: '', url: '', hideUrl: true,
      icon: undefined, iconType: undefined, coverImage: undefined, coverImageAlt: undefined };
  }
  if (link.type === 'internal_links') {
    return { ...normalized, type: 'internal_links', title: '', description: '', url: '', hideUrl: true,
      icon: undefined, iconType: undefined, coverImage: undefined, coverImageAlt: undefined,
      content: buildBlockContent(getInternalLinksData(normalized.content)) };
  }
  if (normalized.type === 'separator') {
    return { ...normalized, description: '', url: '', icon: undefined, iconType: undefined,
      coverImage: undefined, coverImageAlt: undefined };
  }
  return normalized;
}

export async function commitWorkingLinks<T>({
  isDirty,
  links,
  onSave,
}: {
  isDirty: boolean;
  links: T[];
  onSave: (links: T[]) => void | Promise<void>;
}): Promise<SaveResult> {
  if (!isDirty) {
    return { saved: false, isDirty: false, error: '' };
  }

  try {
    await onSave(links);
    return { saved: true, isDirty: false, error: '' };
  } catch (error) {
    return {
      saved: false,
      isDirty: true,
      error: getSaveErrorMessage(error),
    };
  }
}
