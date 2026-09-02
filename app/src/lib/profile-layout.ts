import {
  ORBITPAGE_PROFILE_LAYOUT_ITEMS,
  type OrbitPageProfileLayout,
  type OrbitPageProfileLayoutItem,
} from "@orbitpage/page-schema";

export type ProfileLayout = OrbitPageProfileLayout;
export type ProfileLayoutItem = OrbitPageProfileLayoutItem;
export type ProfileLayoutViewport = "mobile" | "desktop";
export type ProfileLayoutRect = { x: number; y: number; width: number; height: number };
export type NormalizedProfileLayout = {
  positions: Record<ProfileLayoutItem, ProfileLayoutRect>;
  height: number;
};

const ITEM_HEIGHTS: Record<ProfileLayoutItem, number> = {
  avatar: 112,
  name: 64,
  work: 40,
  location: 40,
  socials: 48,
  bio: 80,
};

export const DEFAULT_PROFILE_LAYOUT: NormalizedProfileLayout = {
  positions: {
    avatar: { x: 35, y: 0, width: 30, height: 112 },
    name: { x: 10, y: 128, width: 80, height: 64 },
    work: { x: 8, y: 208, width: 40, height: 40 },
    location: { x: 52, y: 208, width: 40, height: 40 },
    socials: { x: 10, y: 264, width: 80, height: 48 },
    bio: { x: 5, y: 328, width: 90, height: 80 },
  },
  height: 408,
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Math.round(value * 4) / 4;
const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Number(value) : fallback;

function normalizeRect(candidate: Partial<ProfileLayoutRect> | undefined, fallback: ProfileLayoutRect): ProfileLayoutRect {
  const width = round(clamp(finite(candidate?.width, fallback.width), 12, 100));
  return {
    x: round(clamp(finite(candidate?.x, fallback.x), 0, 100 - width)),
    y: Math.round(clamp(finite(candidate?.y, fallback.y), 0, 1_600)),
    width,
    height: Math.round(clamp(finite(candidate?.height, fallback.height), 36, 600)),
  };
}

function migrateGridLayout(layout: ProfileLayout): NormalizedProfileLayout {
  const requestedOrder = (layout.order || []).filter((item, index, items) => (
    ORBITPAGE_PROFILE_LAYOUT_ITEMS.includes(item) && items.indexOf(item) === index
  ));
  const order = [...requestedOrder, ...ORBITPAGE_PROFILE_LAYOUT_ITEMS.filter((item) => !requestedOrder.includes(item))];
  const gap = layout.gap ?? 16;
  const positions = {} as Record<ProfileLayoutItem, ProfileLayoutRect>;
  let y = 0;

  for (let index = 0; index < order.length;) {
    const item = order[index];
    const isHalf = layout.spans?.[item] === 1;
    const next = order[index + 1];
    const pair = isHalf && next && layout.spans?.[next] === 1;
    if (pair) {
      const height = Math.max(ITEM_HEIGHTS[item], ITEM_HEIGHTS[next]);
      positions[item] = { x: 0, y, width: 48, height: ITEM_HEIGHTS[item] };
      positions[next] = { x: 52, y, width: 48, height: ITEM_HEIGHTS[next] };
      y += height + gap;
      index += 2;
    } else {
      positions[item] = { x: 0, y, width: isHalf ? 48 : 100, height: ITEM_HEIGHTS[item] };
      y += ITEM_HEIGHTS[item] + gap;
      index += 1;
    }
  }

  return { positions, height: Math.max(160, y - gap) };
}

export function normalizeProfileLayout(layout?: ProfileLayout | null): NormalizedProfileLayout {
  const base = layout && !layout.positions ? migrateGridLayout(layout) : DEFAULT_PROFILE_LAYOUT;
  const positions = Object.fromEntries(ORBITPAGE_PROFILE_LAYOUT_ITEMS.map((item) => [
    item,
    normalizeRect(layout?.positions?.[item], base.positions[item]),
  ])) as NormalizedProfileLayout["positions"];
  const contentHeight = Math.max(...Object.values(positions).map((rect) => rect.y + rect.height));
  return {
    positions,
    height: Math.round(clamp(Math.max(layout?.height ?? base.height, contentHeight), 160, 2_000)),
  };
}

export function updateProfileLayoutItem(
  layout: ProfileLayout | null | undefined,
  item: ProfileLayoutItem,
  rect: ProfileLayoutRect,
): NormalizedProfileLayout {
  const normalized = normalizeProfileLayout(layout);
  const nextRect = normalizeRect(rect, normalized.positions[item]);
  const positions = { ...normalized.positions, [item]: nextRect };
  const contentHeight = Math.max(...Object.values(positions).map((position) => position.y + position.height));
  return { positions, height: Math.round(clamp(Math.max(160, contentHeight), 160, 2_000)) };
}
