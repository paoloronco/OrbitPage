import type { LinkData } from './LinkCard';

export const mergeLinkPreviews = (links: LinkData[], drafts: ReadonlyMap<string, LinkData>) =>
  links.map((link) => drafts.get(String(link.id)) || link);
