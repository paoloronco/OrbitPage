import {
  ORBITPAGE_CARD_CONTENT_LAYOUT_ITEMS,
  type OrbitPageCardContentLayout,
  type OrbitPageCardContentLayoutItem,
  type OrbitPageCardLayout,
} from "@orbitpage/page-schema";

import type { ProfileLayoutRect, ProfileLayoutViewport } from "./profile-layout";

export type CardLayout = OrbitPageCardLayout;
export type CardContentLayout = OrbitPageCardContentLayout;
export type CardContentLayoutItem = OrbitPageCardContentLayoutItem;
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
};
export type NormalizedCardLayout = {
  positions: Record<string, CardLayoutRect>;
  contents?: Record<string, CardContentLayout>;
  height: number;
};
export type NormalizedCardContentLayout = {
  positions: Record<CardContentLayoutItem, CardLayoutRect>;
  height: number;
};
export type CardLayoutGuides = { x?: number; y?: number };

const CARD_GAP = 24;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number) => Math.round(value * 4) / 4;
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

export function alignCardLayoutRect(
  positions: Record<string, CardLayoutRect>,
  canvasHeight: number,
  item: string,
  rect: CardLayoutRect,
  mode: "move" | "resize",
  thresholdX: number,
  thresholdY: number,
) {
  const others = Object.entries(positions).filter(([id]) => id !== item).map(([, position]) => position);
  const xTargets = [0, 50, 100, ...others.flatMap((position) => [position.x, position.x + position.width / 2, position.x + position.width])];
  const yTargets = [0, canvasHeight, ...others.flatMap((position) => [position.y, position.y + position.height / 2, position.y + position.height])];
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

const defaultCardHeight = (card: CardLayoutSource) => {
  if (card.coverImage) return 260;
  if (["image", "video", "embed", "map", "menu"].includes(card.type || "")) return 220;
  if (card.type === "text" || card.type === "callout" || card.type === "event") return 132;
  if (card.type === "separator") return 48;
  if (card.type === "heading") return 72;
  return card.size === "large" ? 120 : card.size === "small" ? 92 : 100;
};

export const isCompactMobileCard = (card: CardLayoutSource) => (
  card.size === "small" && !["image", "video", "embed", "map", "menu", "text", "callout", "event"].includes(card.type || "link")
);

function normalizeCardRect(
  candidate: Partial<CardLayoutRect> | undefined,
  fallback: CardLayoutRect,
  card: CardLayoutSource,
  viewport: CardLayoutViewport,
): CardLayoutRect {
  const compactMobile = viewport === "mobile" && isCompactMobileCard(card);
  const minimumWidth = compactMobile ? 44 : viewport === "mobile" ? 100 : 20;
  const width = round(clamp(finite(candidate?.width, fallback.width), minimumWidth, 100));
  return {
    x: viewport === "mobile" && !compactMobile
      ? 0
      : round(clamp(finite(candidate?.x, fallback.x), 0, 100 - width)),
    y: Math.round(clamp(finite(candidate?.y, fallback.y), 0, 4_000)),
    width,
    height: Math.round(clamp(finite(candidate?.height, fallback.height), 48, 1_200)),
  };
}

export function normalizeCardLayout(
  layout: CardLayout | null | undefined,
  cards: CardLayoutSource[],
  viewport: CardLayoutViewport,
): NormalizedCardLayout {
  const positions: Record<string, CardLayoutRect> = {};
  let nextY = layout?.positions
    ? Math.max(0, ...Object.values(layout.positions).map((rect) => rect.y + rect.height + CARD_GAP))
    : 0;

  for (const card of cards) {
    const fallback = { x: 0, y: nextY, width: 100, height: defaultCardHeight(card) };
    const rect = normalizeCardRect(layout?.positions?.[card.id], fallback, card, viewport);
    positions[card.id] = rect;
    nextY = Math.max(nextY, rect.y + rect.height + CARD_GAP);
  }

  const contentHeight = Math.max(48, ...Object.values(positions).map((rect) => rect.y + rect.height));
  return {
    positions,
    ...(layout?.contents ? { contents: layout.contents } : {}),
    height: Math.round(clamp(Math.max(layout?.height ?? 0, contentHeight), 48, 6_000)),
  };
}

export function updateCardLayoutItem(
  layout: CardLayout | null | undefined,
  cards: CardLayoutSource[],
  viewport: CardLayoutViewport,
  cardId: string,
  rect: CardLayoutRect,
): NormalizedCardLayout {
  const normalized = normalizeCardLayout(layout, cards, viewport);
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) return normalized;
  const positions = {
    ...normalized.positions,
    [cardId]: normalizeCardRect(rect, normalized.positions[cardId], card, viewport),
  };
  return {
    positions,
    ...(normalized.contents ? { contents: normalized.contents } : {}),
    height: Math.round(Math.max(48, ...Object.values(positions).map((position) => position.y + position.height))),
  };
}

export function dockDesktopCards(
  layout: CardLayout | null | undefined,
  cards: CardLayoutSource[],
  cardId: string,
  targetId: string,
  side: "left" | "right",
): NormalizedCardLayout {
  const normalized = normalizeCardLayout(layout, cards, "desktop");
  if (cardId === targetId || !normalized.positions[cardId] || !normalized.positions[targetId]) return normalized;
  const leftId = side === "left" ? cardId : targetId;
  const rightId = side === "right" ? cardId : targetId;
  const y = normalized.positions[targetId].y;
  const left = updateCardLayoutItem(normalized, cards, "desktop", leftId, {
    ...normalized.positions[leftId], x: 0, y, width: 49,
  });
  return updateCardLayoutItem(left, cards, "desktop", rightId, {
    ...left.positions[rightId], x: 51, y, width: 49,
  });
}

const DEFAULT_CARD_CONTENT_LAYOUT: NormalizedCardContentLayout = {
  positions: {
    icon: { x: 0, y: 14, width: 12, height: 36 },
    title: { x: 16, y: 0, width: 80, height: 24 },
    description: { x: 16, y: 25, width: 80, height: 22 },
    url: { x: 16, y: 48, width: 80, height: 18 },
  },
  height: 66,
};

function normalizeContentRect(candidate: Partial<CardLayoutRect> | undefined, fallback: CardLayoutRect): CardLayoutRect {
  const width = round(clamp(finite(candidate?.width, fallback.width), 12, 100));
  return {
    x: round(clamp(finite(candidate?.x, fallback.x), 0, 100 - width)),
    y: Math.round(clamp(finite(candidate?.y, fallback.y), 0, 1_000)),
    width,
    height: Math.round(clamp(finite(candidate?.height, fallback.height), 24, 600)),
  };
}

export function normalizeCardContentLayout(layout?: CardContentLayout | null): NormalizedCardContentLayout {
  const positions = Object.fromEntries(ORBITPAGE_CARD_CONTENT_LAYOUT_ITEMS.map((item) => [
    item,
    normalizeContentRect(layout?.positions?.[item], DEFAULT_CARD_CONTENT_LAYOUT.positions[item]),
  ])) as NormalizedCardContentLayout["positions"];
  const contentHeight = Math.max(...Object.values(positions).map((rect) => rect.y + rect.height));
  return {
    positions,
    height: Math.round(clamp(Math.max(layout?.height ?? DEFAULT_CARD_CONTENT_LAYOUT.height, contentHeight), 48, 1_200)),
  };
}

export function updateCardContentLayoutItem(
  layout: CardLayout | null | undefined,
  cards: CardLayoutSource[],
  viewport: CardLayoutViewport,
  cardId: string,
  item: CardContentLayoutItem,
  rect: CardLayoutRect,
): NormalizedCardLayout {
  const normalized = normalizeCardLayout(layout, cards, viewport);
  const content = normalizeCardContentLayout(layout?.contents?.[cardId]);
  const positions = { ...content.positions, [item]: normalizeContentRect(rect, content.positions[item]) };
  const nextContent = {
    positions,
    height: Math.round(Math.max(48, ...Object.values(positions).map((position) => position.y + position.height))),
  };
  return {
    ...normalized,
    contents: { ...layout?.contents, [cardId]: nextContent },
  };
}
