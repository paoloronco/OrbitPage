import {
  ORBITPAGE_PROFILE_CARD_LAYOUT_ID,
  type OrbitPageCardContentLayout,
  type OrbitPageCardLayout,
} from "@orbitpage/page-schema";

import type { ProfileLayoutRect, ProfileLayoutViewport } from "./profile-layout";

export type CardLayout = OrbitPageCardLayout;
export type CardContentLayout = OrbitPageCardContentLayout;
export type CardLayoutViewport = ProfileLayoutViewport;
export type CardLayoutRect = ProfileLayoutRect;
export type CardLayoutSource = {
  id: string;
  type?: string;
  size?: string;
  description?: string;
  url?: string;
  hideUrl?: boolean;
  coverImage?: string;
  defaultRect?: Partial<CardLayoutRect>;
  prepend?: boolean;
};
export type NormalizedCardLayout = {
  profileMinHeight?: number;
  positions: Record<string, CardLayoutRect>;
  contents?: Record<string, CardContentLayout>;
  height: number;
};
export type CardLayoutGuides = { x?: number; y?: number };

const CARD_GAP = 24;
const LEGACY_PROFILE_CARD_LAYOUT_ID = "__orbitpage_profile__";

export const PROFILE_CARD_LAYOUT_ID = ORBITPAGE_PROFILE_CARD_LAYOUT_ID;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Math.round(value * 100) / 100;
const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? Number(value) : fallback;
function closestSnap(anchors: number[], targets: number[], threshold: number) {
  let best: { shift: number; guide: number } | null = null;
  for (const anchor of anchors) {
    for (const target of targets) {
      const shift = target - anchor;
      if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) {
        best = { shift, guide: target };
      }
    }
  }
  return best;
}

const overlaps = (left: CardLayoutRect, right: CardLayoutRect) => (
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y
);

export const hasCardLayoutOverlap = (
  positions: Record<string, CardLayoutRect>,
  item: string,
  candidate = positions[item],
) => Object.entries(positions).some(([id, position]) => id !== item && overlaps(candidate, position));

export function alignCardLayoutRect(
  positions: Record<string, CardLayoutRect>,
  canvasHeight: number,
  item: string,
  rect: CardLayoutRect,
  mode: "move" | "resize",
  thresholdX: number,
  thresholdY: number,
  gapX = 0,
  gapY = 0,
) {
  const others = Object.entries(positions).filter(([id]) => id !== item).map(([, position]) => position);
  const xTargets = [0, 50, 100, ...others.flatMap((position) => [position.x - gapX, position.x, position.x + position.width / 2, position.x + position.width, position.x + position.width + gapX])];
  const yTargets = [0, canvasHeight, ...others.flatMap((position) => [position.y - gapY, position.y, position.y + position.height / 2, position.y + position.height, position.y + position.height + gapY])];
  const xSnap = closestSnap(mode === "move" ? [rect.x, rect.x + rect.width / 2, rect.x + rect.width] : [rect.x + rect.width], xTargets, thresholdX);
  const ySnap = closestSnap(mode === "move" ? [rect.y, rect.y + rect.height / 2, rect.y + rect.height] : [rect.y + rect.height], yTargets, thresholdY);
  return {
    rect: {
      ...rect,
      ...(xSnap ? (mode === "move" ? { x: rect.x + xSnap.shift } : { width: rect.width + xSnap.shift }) : {}),
      ...(ySnap ? (mode === "move" ? { y: rect.y + ySnap.shift } : { height: rect.height + ySnap.shift }) : {}),
    },
    guides: { x: xSnap?.guide, y: ySnap?.guide } as CardLayoutGuides,
  };
}

// The dragged item owns its destination; only intersecting neighbors make room.
export function reflowLayoutItem<T extends { positions: Record<string, CardLayoutRect>; height: number }>(
  layout: T,
  item: string,
  gap = CARD_GAP,
  maximumY = 4_000,
  previousRect?: CardLayoutRect,
): T | null {
  let active = layout.positions[item];
  if (!active) return layout;
  const others = Object.entries(layout.positions).filter(([id]) => id !== item).sort(([, a], [, b]) => a.y - b.y || a.x - b.x);
  const reordered: Record<string, CardLayoutRect> = {};
  if (previousRect && active.x === previousRect.x && active.width === previousRect.width) {
    const down = active.y > previousRect.y;
    const crossed = others.filter(([, rect]) => rect.x === active.x && rect.width === active.width
      && (down ? rect.y >= previousRect.y + previousRect.height && rect.y + rect.height / 2 <= active.y + active.height / 2
        : rect.y + rect.height <= previousRect.y && rect.y + rect.height / 2 >= active.y + active.height / 2));
    if (crossed.length) {
      let y = down ? previousRect.y : crossed[0][1].y;
      const ordered: [string, CardLayoutRect][] = down ? [...crossed, [item, active]] : [[item, active], ...crossed];
      for (const [id, rect] of ordered) {
        reordered[id] = { ...rect, y };
        y += rect.height + gap;
      }
      active = reordered[item];
    }
  }
  if (active.y > maximumY) return null;
  const positions: Record<string, CardLayoutRect> = { [item]: active };
  for (const [id, rect] of others) {
    const next = { ...(reordered[id] || rect) };
    for (const placed of Object.values(positions).sort((a, b) => a.y - b.y)) {
      if (overlaps(next, placed)) next.y = placed.y + placed.height + gap;
    }
    if (next.y > maximumY) return null;
    positions[id] = next;
  }
  return { ...layout, positions, height: Math.max(48, ...Object.values(positions).map(rect => rect.y + rect.height)) };
}

export function snapCardLayoutGaps(
  positions: Record<string, CardLayoutRect>, item: string, rect: CardLayoutRect,
  mode: "move" | "resize", canvasWidth: number, minimumWidth: number,
) {
  const gap = CARD_GAP / canvasWidth * 100;
  const tolerance = 8 / canvasWidth * 100;
  let candidate = { ...rect };
  for (const [id, other] of Object.entries(positions)) {
    if (id === item || rect.y + rect.height <= other.y || rect.y >= other.y + other.height) continue;
    if (mode === "resize") {
      const width = other.x - gap - rect.x;
      if (width >= minimumWidth && Math.abs(rect.width - width) <= tolerance) candidate.width = width;
    } else {
      const right = other.x + other.width + gap;
      const left = other.x - gap - rect.width;
      if (Math.abs(rect.x - right) <= tolerance && right + minimumWidth <= 100) {
        const width = Math.min(rect.width, 100 - right);
        if (rect.width - width <= tolerance) candidate = { ...candidate, x: right, width };
      } else if (Math.abs(rect.x - left) <= tolerance && left >= -tolerance && other.x - gap >= minimumWidth) {
        candidate = { ...candidate, x: Math.max(0, left), width: Math.min(rect.width, other.x - gap) };
      }
    }
  }
  return candidate;
}

export const defaultCardHeight = (card: CardLayoutSource) => {
  if (card.defaultRect?.height !== undefined) return clamp(card.defaultRect.height, 48, 1_200);
  if (card.coverImage) return 260;
  if (["image", "video", "embed", "map", "menu"].includes(card.type || "")) return 220;
  if (card.type === "text" || card.type === "callout" || card.type === "event") return 132;
  if (card.type === "separator") return 48;
  if (card.type === "heading") return 72;
  return card.size === "large" ? 120 : card.size === "small" ? 92 : 100;
};

function normalizeCardRect(
  candidate: Partial<CardLayoutRect> | undefined,
  fallback: CardLayoutRect,
  card: CardLayoutSource,
  viewport: CardLayoutViewport,
): CardLayoutRect {
  const minimumWidth = viewport === "mobile" ? 44 : 20;
  const minimumHeight = defaultCardHeight(card);
  const width = round(clamp(finite(candidate?.width, fallback.width), minimumWidth, 100));
  return {
    x: round(clamp(finite(candidate?.x, fallback.x), 0, 100 - width)),
    y: Math.round(clamp(finite(candidate?.y, fallback.y), 0, 4_000)),
    width,
    height: Math.round(clamp(finite(candidate?.height, fallback.height), minimumHeight, 1_200)),
  };
}

export function normalizeCardLayout(
  layout: CardLayout | null | undefined,
  cards: CardLayoutSource[],
  viewport: CardLayoutViewport,
): NormalizedCardLayout {
  const positions: Record<string, CardLayoutRect> = {};
  let initialPositions = layout?.positions ? { ...layout.positions } : undefined;
  let storedHeight = layout?.height ?? 0;
  if (initialPositions?.[LEGACY_PROFILE_CARD_LAYOUT_ID]) {
    initialPositions[PROFILE_CARD_LAYOUT_ID] ??= initialPositions[LEGACY_PROFILE_CARD_LAYOUT_ID];
    delete initialPositions[LEGACY_PROFILE_CARD_LAYOUT_ID];
  }
  // Measured profiles can exceed stored rectangle bounds; compact their followers by the same amount before saving.
  if (initialPositions?.[PROFILE_CARD_LAYOUT_ID]?.height > 1_200) {
    const bounded = fitCardLayoutHeights({ positions: initialPositions, height: storedHeight }, { [PROFILE_CARD_LAYOUT_ID]: 1_200 }, true, true);
    initialPositions = bounded.positions;
    storedHeight = bounded.height;
  }
  const missingPrepend = cards.find((card) => card.prepend && !initialPositions?.[card.id]);
  const prependOffset = missingPrepend ? defaultCardHeight(missingPrepend) + CARD_GAP : 0;
  const storedPositions = prependOffset
    ? Object.fromEntries(Object.entries(initialPositions || {}).map(([id, rect]) => [id, { ...rect, y: rect.y + prependOffset }]))
    : initialPositions;
  let nextY = storedPositions
    ? Math.max(0, ...Object.values(storedPositions).map((rect) => rect.y + rect.height + CARD_GAP))
    : 0;

  for (const card of cards) {
    const fallback = {
      x: card.defaultRect?.x ?? 0,
      y: card.prepend ? (card.defaultRect?.y ?? 0) : nextY,
      width: card.defaultRect?.width ?? 100,
      height: defaultCardHeight(card),
    };
    const rect = normalizeCardRect(storedPositions?.[card.id], fallback, card, viewport);
    positions[card.id] = rect;
    nextY = Math.max(nextY, rect.y + rect.height + CARD_GAP);
  }

  const contentHeight = Math.max(48, ...Object.values(positions).map((rect) => rect.y + rect.height));
  return {
    positions,
    ...(layout?.profileMinHeight !== undefined ? { profileMinHeight: clamp(layout.profileMinHeight, 48, 1_200) } : {}),
    ...(layout?.contents ? { contents: layout.contents } : {}),
    height: Math.round(clamp(Math.max(storedHeight + prependOffset, contentHeight), 48, 6_000)),
  };
}

export function updateCardLayoutItem(
  layout: CardLayout | null | undefined,
  cards: CardLayoutSource[],
  viewport: CardLayoutViewport,
  cardId: string,
  rect: CardLayoutRect,
  mode: "move" | "resize" = "move",
): NormalizedCardLayout {
  const bounded = normalizeCardLayout(layout, cards, viewport);
  const measuredProfileHeight = layout?.positions?.[PROFILE_CARD_LAYOUT_ID]?.height ?? 0;
  const normalized = measuredProfileHeight > 1_200
    ? fitCardLayoutHeights(bounded, { [PROFILE_CARD_LAYOUT_ID]: measuredProfileHeight }, true, true)
    : bounded;
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) return normalized;
  const candidate = normalizeCardRect(rect, normalized.positions[cardId], card, viewport);
  const positions = { ...normalized.positions, [cardId]: candidate };
  return {
    ...normalized,
    ...(cardId === PROFILE_CARD_LAYOUT_ID && mode === "resize" && candidate.height !== normalized.positions[cardId].height
      ? { profileMinHeight: candidate.height } : {}),
    positions,
    height: Math.round(Math.max(48, ...Object.values(positions).map((position) => position.y + position.height))),
  };
}

export function moveMobileCard(
  layout: CardLayout | null | undefined,
  cards: CardLayoutSource[],
  visibleIds: string[],
  cardId: string,
  direction: -1 | 1,
): NormalizedCardLayout | null {
  const index = visibleIds.indexOf(cardId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= visibleIds.length) return null;
  const normalized = normalizeCardLayout(layout, cards, "mobile");
  const order = [...visibleIds];
  [order[index], order[target]] = [order[target], order[index]];
  const positions = { ...layout?.positions, ...normalized.positions };
  let y = normalized.positions[visibleIds[0]]?.y ?? 0;
  for (const id of order) {
    const rect = normalized.positions[id];
    if (!rect) return null;
    positions[id] = { ...rect, y };
    y += rect.height + CARD_GAP;
  }
  return { ...normalized, positions, height: Math.max(normalized.height, y - CARD_GAP) };
}

// Preserve saved gaps and columns; repair older overlapping layouts without changing saved data.
export function fitCardLayoutHeights(layout: NormalizedCardLayout, heights: Record<string, number>, moveFollowing = true, fitProfileHeight = false): NormalizedCardLayout {
  const positions: Record<string, CardLayoutRect> = {};
  const ordered = Object.entries(layout.positions).sort(([, a], [, b]) => a.y - b.y);
  for (const [id, rect] of ordered) {
    let growth: number | undefined;
    if (moveFollowing) {
      const preceding = Object.entries(positions).filter(([previousId]) => {
        const original = layout.positions[previousId];
        return rect.y >= original.y + original.height && rect.x < original.x + original.width && rect.x + rect.width > original.x;
      });
      const precedingBottom = Math.max(0, ...preceding.map(([id]) => layout.positions[id].y + layout.positions[id].height));
      for (const [previousId, previous] of preceding) {
        const original = layout.positions[previousId];
        const baseline = fitProfileHeight ? precedingBottom : original.y + original.height;
        growth = Math.max(growth ?? (fitProfileHeight ? -Infinity : 0), previous.y + previous.height - baseline);
      }
    }
    const height = fitProfileHeight && id === PROFILE_CARD_LAYOUT_ID && heights[id]
      ? Math.max(layout.profileMinHeight ?? 48, heights[id])
      : Math.max(rect.height, heights[id] || 0);
    const fitted = { ...rect, y: rect.y + (growth ?? 0), height };
    if (moveFollowing) {
      for (const previous of Object.values(positions).sort((a, b) => a.y - b.y)) {
        if (overlaps(fitted, previous)) fitted.y = previous.y + previous.height + CARD_GAP;
      }
    }
    positions[id] = fitted;
  }
  const profileDelta = fitProfileHeight && positions[PROFILE_CARD_LAYOUT_ID]
    ? Math.min(0, positions[PROFILE_CARD_LAYOUT_ID].height - layout.positions[PROFILE_CARD_LAYOUT_ID].height)
    : 0;
  return { ...layout, positions, height: Math.max(layout.height + profileDelta, ...Object.values(positions).map(rect => rect.y + rect.height)) };
}
