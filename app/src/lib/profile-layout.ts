import {
  ORBITPAGE_PROFILE_LAYOUT_ITEMS,
  type OrbitPageProfileLayout,
  type OrbitPageProfileLayoutItem,
} from "@orbitpage/page-schema";

export type ProfileLayout = OrbitPageProfileLayout;
export type ProfileLayoutItem = OrbitPageProfileLayoutItem;
export type NormalizedProfileLayout = {
  order: ProfileLayoutItem[];
  spans: Record<ProfileLayoutItem, 1 | 2>;
  gap: number;
};

// ponytail: two responsive columns keep public layouts readable; add per-device grids only if real layouts outgrow this model.
export const DEFAULT_PROFILE_LAYOUT: NormalizedProfileLayout = {
  order: [...ORBITPAGE_PROFILE_LAYOUT_ITEMS],
  spans: {
    avatar: 1,
    name: 1,
    work: 1,
    location: 1,
    socials: 2,
    bio: 2,
  },
  gap: 16,
};

export function normalizeProfileLayout(layout?: ProfileLayout | null): NormalizedProfileLayout {
  const order = (layout?.order || []).filter((item, index, items) => (
    ORBITPAGE_PROFILE_LAYOUT_ITEMS.includes(item) && items.indexOf(item) === index
  ));
  for (const item of ORBITPAGE_PROFILE_LAYOUT_ITEMS) {
    if (!order.includes(item)) order.push(item);
  }

  return {
    order,
    spans: Object.fromEntries(ORBITPAGE_PROFILE_LAYOUT_ITEMS.map((item) => {
      const span = layout?.spans?.[item];
      return [item, span === 1 || span === 2 ? span : DEFAULT_PROFILE_LAYOUT.spans[item]];
    })) as NormalizedProfileLayout["spans"],
    gap: Math.min(32, Math.max(8, Math.round((layout?.gap ?? DEFAULT_PROFILE_LAYOUT.gap) / 4) * 4)),
  };
}

export function reorderProfileLayout(
  layout: ProfileLayout | null | undefined,
  item: ProfileLayoutItem,
  before: ProfileLayoutItem,
): NormalizedProfileLayout {
  const normalized = normalizeProfileLayout(layout);
  if (item === before) return normalized;
  const order = normalized.order.filter((candidate) => candidate !== item);
  order.splice(order.indexOf(before), 0, item);
  return { ...normalized, order };
}

export function moveProfileLayoutItem(
  layout: ProfileLayout | null | undefined,
  item: ProfileLayoutItem,
  direction: -1 | 1,
): NormalizedProfileLayout {
  const normalized = normalizeProfileLayout(layout);
  const index = normalized.order.indexOf(item);
  const target = Math.min(normalized.order.length - 1, Math.max(0, index + direction));
  if (target === index) return normalized;
  const order = [...normalized.order];
  [order[index], order[target]] = [order[target], order[index]];
  return { ...normalized, order };
}

export function resizeProfileLayoutItem(
  layout: ProfileLayout | null | undefined,
  item: ProfileLayoutItem,
  span: 1 | 2,
): NormalizedProfileLayout {
  const normalized = normalizeProfileLayout(layout);
  return { ...normalized, spans: { ...normalized.spans, [item]: span } };
}
