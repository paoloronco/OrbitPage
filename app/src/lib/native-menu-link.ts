import type { LinkData } from '@/components/LinkCard';

export const NATIVE_MENU_LINK_ID = 'orbitpage-native-menu';

export const buildNativeMenuHref = (publicPageHref: string) => {
  const baseHref = publicPageHref.trim().replace(/\/+$/, '');
  return baseHref ? `${baseHref}/menu` : '/menu';
};

export const createNativeMenuLink = (
  publicPageHref: string,
  copy: { title: string; description: string },
): LinkData => ({
  id: NATIVE_MENU_LINK_ID,
  title: copy.title,
  description: copy.description,
  url: buildNativeMenuHref(publicPageHref),
  hideUrl: true,
  type: 'menu',
  size: 'large',
  status: 'live',
  isActive: true,
});

export const isNativeMenuLink = (link: Pick<LinkData, 'id' | 'type'>) =>
  link.type === 'menu' || link.id === NATIVE_MENU_LINK_ID;

export const upsertNativeMenuLink = (
  links: LinkData[],
  menuLink: LinkData,
  placement: 'append' | 'prepend' = 'append',
) => {
  let replaced = false;
  const deduplicated = links.flatMap((link) => {
    if (!isNativeMenuLink(link)) return [link];
    if (replaced) return [];
    replaced = true;
    return [{ ...link, ...menuLink, id: link.id }];
  });

  if (replaced) return deduplicated;
  return placement === 'prepend' ? [menuLink, ...deduplicated] : [...deduplicated, menuLink];
};
