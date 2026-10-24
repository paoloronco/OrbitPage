import {
  ORBITPAGE_PROFILE_LAYOUT_ITEMS,
  type OrbitPageProfileLayout,
  type OrbitPageProfileLayoutItem,
} from "@orbitpage/page-schema";
import { fitCardLayoutHeights, hasCardLayoutOverlap } from "./card-layout";

export type ProfileLayout = OrbitPageProfileLayout;
export type ProfileLayoutItem = OrbitPageProfileLayoutItem;
export type ProfileLayoutViewport = "mobile" | "desktop";
export type ProfileLayoutRect = { x: number; y: number; width: number; height: number };
export type ProfileLayoutAlignment = "left" | "center" | "right";
export type NormalizedProfileLayout = {
  positions: Record<ProfileLayoutItem, ProfileLayoutRect>;
  alignments: Record<ProfileLayoutItem, ProfileLayoutAlignment>;
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
  alignments: {
    avatar: "center",
    name: "center",
    work: "center",
    location: "center",
    socials: "center",
    bio: "center",
  },
  height: 408,
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Math.round(value * 100) / 100;
const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Number(value) : fallback;

export function snapProfileLayoutRect(rect: ProfileLayoutRect, mode: "move" | "resize", canvasWidth: number): ProfileLayoutRect {
  const snapX = (value: number) => round(Math.round(value * canvasWidth / 100 / 8) * 8 / canvasWidth * 100);
  return mode === "move"
    ? { ...rect, x: snapX(rect.x), y: Math.round(rect.y / 8) * 8 }
    : { ...rect, width: snapX(rect.width), height: Math.round(rect.height / 8) * 8 };
}

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

  return { positions, alignments: DEFAULT_PROFILE_LAYOUT.alignments, height: Math.max(160, y - gap) };
}

export function normalizeProfileLayout(layout?: ProfileLayout | null): NormalizedProfileLayout {
  const base = layout && !layout.positions ? migrateGridLayout(layout) : DEFAULT_PROFILE_LAYOUT;
  const positions = Object.fromEntries(ORBITPAGE_PROFILE_LAYOUT_ITEMS.map((item) => [
    item,
    normalizeRect(layout?.positions?.[item], base.positions[item]),
  ])) as NormalizedProfileLayout["positions"];
  const alignments = Object.fromEntries(ORBITPAGE_PROFILE_LAYOUT_ITEMS.map((item) => [
    item,
    layout?.alignments?.[item] || base.alignments[item],
  ])) as NormalizedProfileLayout["alignments"];
  const contentHeight = Math.max(...Object.values(positions).map((rect) => rect.y + rect.height));
  return {
    positions,
    alignments,
    height: Math.round(clamp(Math.max(layout?.height ?? base.height, contentHeight), 160, 2_000)),
  };
}

export function normalizeVisibleProfileLayout(
  layout: ProfileLayout | null | undefined,
  visibleItems: ProfileLayoutItem[],
): NormalizedProfileLayout {
  const normalized = normalizeProfileLayout(layout);
  const visible = new Set(visibleItems);

  if (!layout?.positions) {
    const rows = [...new Set(ORBITPAGE_PROFILE_LAYOUT_ITEMS.filter((item) => visible.has(item))
      .map((item) => normalized.positions[item].y))].sort((a, b) => a - b);
    const positions = { ...normalized.positions };
    let nextY = 0;
    for (const rowY of rows) {
      const rowItems = ORBITPAGE_PROFILE_LAYOUT_ITEMS.filter((item) => visible.has(item) && normalized.positions[item].y === rowY);
      for (const item of rowItems) positions[item] = { ...positions[item], y: nextY };
      nextY += Math.max(...rowItems.map((item) => positions[item].height)) + (layout?.gap ?? 16);
    }
    normalized.positions = positions;
  }

  const contentHeight = Math.max(160, ...visibleItems.map((item) => {
    const rect = normalized.positions[item];
    return rect.y + rect.height;
  }));
  return { ...normalized, height: Math.round(clamp(contentHeight, 160, 2_000)) };
}

export function fitVisibleProfileLayout(
  layout: NormalizedProfileLayout,
  visibleItems: ProfileLayoutItem[],
  heights: Record<string, number>,
): NormalizedProfileLayout {
  const positions = Object.fromEntries(visibleItems.map(id => [id, layout.positions[id]]));
  const { work, location } = positions;
  const sharedDetailRow = work && location && work.y === location.y
    && (work.x + work.width <= location.x || location.x + location.width <= work.x)
    // Preserve valid manual arrangements beneath the shorter detail column.
    && !visibleItems.some(id => id !== "work" && id !== "location" && positions[id].y >= work.y
      && positions[id].y < Math.max(work.y + work.height, location.y + location.height)
      && !hasCardLayoutOverlap({ work, location, [id]: positions[id] }, id));

  // Fit a saved detail row together so growth in either column cannot split its baseline.
  if (sharedDetailRow) {
    positions.work = {
      x: Math.min(work.x, location.x), y: work.y,
      width: Math.max(work.x + work.width, location.x + location.width) - Math.min(work.x, location.x),
      height: Math.max(work.height, location.height),
    };
    delete positions.location;
  }
  const fitted = fitCardLayoutHeights({ positions, height: layout.height }, sharedDetailRow
    ? { ...heights, work: Math.max(heights.work || 0, heights.location || 0) } : heights);
  if (sharedDetailRow) {
    const y = fitted.positions.work.y;
    fitted.positions.work = { ...work, y, height: Math.max(work.height, heights.work || 0) };
    fitted.positions.location = { ...location, y, height: Math.max(location.height, heights.location || 0) };
  }
  return { ...layout, positions: { ...layout.positions, ...fitted.positions }, height: fitted.height };
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
  return { positions, alignments: normalized.alignments, height: Math.round(clamp(Math.max(160, contentHeight), 160, 2_000)) };
}

export function updateProfileLayoutAlignment(
  layout: ProfileLayout | null | undefined,
  item: ProfileLayoutItem,
  alignment: ProfileLayoutAlignment,
): NormalizedProfileLayout {
  const normalized = normalizeProfileLayout(layout);
  return { ...normalized, alignments: { ...normalized.alignments, [item]: alignment } };
}
