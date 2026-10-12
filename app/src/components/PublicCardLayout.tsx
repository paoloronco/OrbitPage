import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { GripVertical, MoveDiagonal2 } from "lucide-react";

import type { LinkData } from "./LinkCard";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import type { PublicEditorTarget } from "./PublicView";
import {
  alignCardLayoutRect,
  defaultCardHeight,
  normalizeCardContentLayout,
  normalizeCardLayout,
  PROFILE_CARD_LAYOUT_ID,
  reflowCardLayoutPositions,
  snapCardLayoutSize,
  stepCardLayoutWidth,
  updateCardContentLayoutItem,
  updateCardLayoutItem,
  type CardContentLayoutItem,
  type CardLayout,
  type CardLayoutGuides,
  type CardLayoutRect,
  type CardLayoutSource,
  type CardLayoutViewport,
  type NormalizedCardContentLayout,
  type NormalizedCardLayout,
} from "@/lib/card-layout";
import { getContentCardVariantCssVariables, type ThemeConfig } from "@/lib/theme";
import { useAppI18n } from "@/lib/i18n";
import { isNativeShopLink } from "@/lib/native-shop-link";
import { getServiceLinkData } from "@/lib/link-blocks";

interface PublicCardLayoutProps {
  links: LinkData[];
  theme: ThemeConfig;
  layout?: CardLayout | null;
  viewport: CardLayoutViewport;
  layoutEditing?: boolean;
  editorSelection?: PublicEditorTarget | null;
  onEditorSelect?: (target: PublicEditorTarget) => void;
  onLayoutChange?: (layout: CardLayout) => void;
  profileCard?: { content: ReactNode; height: number };
  desktopDefaultWidthCapRem?: number;
}

type Gesture = {
  scope: "card" | "content";
  cardId: string;
  item?: CardContentLayoutItem;
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  startRect: CardLayoutRect;
  layout: NormalizedCardLayout;
  contentLayout?: NormalizedCardContentLayout;
  bounds: DOMRect;
  scale: number;
  minimumHeight: number;
};

type ActiveTarget = { scope: Gesture["scope"]; cardId: string; item?: CardContentLayoutItem } | null;
type ActiveGuides = CardLayoutGuides & { scope?: Gesture["scope"]; cardId?: string };

const supportsContentLayout = (link: LinkData) => !link.type || link.type === "link" || isNativeShopLink(link);

export function PublicCardLayout({
  links,
  theme,
  layout: rawLayout,
  viewport,
  layoutEditing = false,
  editorSelection,
  onEditorSelect,
  onLayoutChange,
  profileCard,
  desktopDefaultWidthCapRem = 72,
}: PublicCardLayoutProps) {
  const { tr } = useAppI18n();
  const hasProfileCard = profileCard !== undefined;
  const profileCardHeight = profileCard?.height;
  const layoutCards = useMemo<CardLayoutSource[]>(() => {
    const configuredWidth = Number.parseFloat(theme.maxWidth);
    const configuredWidthPx = theme.maxWidth.endsWith("rem")
      ? configuredWidth * 16
      : theme.maxWidth.endsWith("vw")
        ? configuredWidth * 12.8
        : configuredWidth;
    const initialWidthPx = Math.min(configuredWidthPx, desktopDefaultWidthCapRem * 16);
    const width = viewport === "desktop" && Number.isFinite(initialWidthPx)
      ? Math.min(100, Math.max(20, initialWidthPx / (72 * 16) * 100))
      : 100;
    const defaultRect = { x: (100 - width) / 2, width };
    return [
      ...(hasProfileCard ? [{
        id: PROFILE_CARD_LAYOUT_ID,
        type: "profile",
        prepend: true,
        defaultRect: { ...defaultRect, y: 0, height: profileCardHeight },
      }] : []),
      ...links.map((link) => ({ ...link, defaultRect, hasIcon: Boolean(link.icon || isNativeShopLink(link) || getServiceLinkData(link.content).service) })),
    ];
  }, [desktopDefaultWidthCapRem, hasProfileCard, links, profileCardHeight, theme.maxWidth, viewport]);
  const savedLayout = useMemo(() => normalizeCardLayout(rawLayout, layoutCards, viewport), [layoutCards, rawLayout, viewport]);
  const [workingLayout, setWorkingLayout] = useState(savedLayout);
  const [activeTarget, setActiveTarget] = useState<ActiveTarget>(null);
  const [guides, setGuides] = useState<ActiveGuides>({});
  const gestureRef = useRef<Gesture | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef<{ clientX: number; clientY: number; pointerId: number } | null>(null);
  const pendingLayoutRef = useRef<NormalizedCardLayout | null>(null);
  const latestLayoutRef = useRef<NormalizedCardLayout>(workingLayout);
  const viewportRef = useRef(viewport);
  const useFreeLayout = layoutEditing || Boolean(rawLayout);
  const activeLayout = layoutEditing ? normalizeCardLayout(workingLayout, layoutCards, viewport) : savedLayout;

  useEffect(() => {
    if (layoutEditing) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    gestureRef.current = null;
    latestLayoutRef.current = savedLayout;
    setWorkingLayout(savedLayout);
  }, [layoutEditing, savedLayout]);

  const applyWorkingLayout = (next: NormalizedCardLayout) => {
    latestLayoutRef.current = next;
    setWorkingLayout(next);
  };

  useLayoutEffect(() => {
    if (!layoutEditing || !canvasRef.current) return;
    let next = viewportRef.current === viewport ? latestLayoutRef.current : savedLayout;
    viewportRef.current = viewport;
    let resizedContent = false;
    for (const canvas of canvasRef.current.querySelectorAll<HTMLElement>("[data-card-content-layout]")) {
      const cardId = canvas.dataset.cardContentLayout!;
      const card = layoutCards.find(item => item.id === cardId);
      if (!card || !supportsContentLayout(card as LinkData)) continue;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !canvas.offsetWidth) continue;
      const scale = bounds.width / canvas.offsetWidth;
      const stored = next.contents?.[cardId];
      let positions = { ...normalizeCardContentLayout(stored, card.hasIcon).positions };
      const visible = [...canvas.querySelectorAll<HTMLElement>("[data-card-content-layout-item]")];
      for (const node of visible) {
        const item = node.dataset.cardContentLayoutItem as CardContentLayoutItem;
        if (stored) {
          const height = Math.min(600, node.querySelector<HTMLElement>(".public-link-card__layout-content")?.scrollHeight || 0);
          if (height > positions[item].height + 1) {
            const visiblePositions = Object.fromEntries(visible.map(element => {
              const id = element.dataset.cardContentLayoutItem as CardContentLayoutItem;
              return [id, positions[id]];
            }));
            positions = { ...positions, ...reflowCardLayoutPositions(visiblePositions, item, { ...positions[item], height }, 4) };
            resizedContent = true;
          }
          continue;
        }
        const rect = node.getBoundingClientRect();
        positions[item] = {
          x: (rect.left - bounds.left) / bounds.width * 100, y: (rect.top - bounds.top) / scale,
          width: rect.width / bounds.width * 100, height: rect.height / scale,
        };
      }
      const content = normalizeCardContentLayout({ positions, height: Math.max(canvas.offsetHeight, ...visible.map(node => {
        const rect = positions[node.dataset.cardContentLayoutItem as CardContentLayoutItem];
        return rect.y + rect.height;
      })) }, card.hasIcon);
      const surface = canvas.closest<HTMLElement>(".glass-card")!;
      const style = getComputedStyle(surface);
      const height = Math.min(1_200, content.height + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom));
      if (stored && JSON.stringify(stored) === JSON.stringify(content) && height <= next.positions[cardId].height) continue;
      next = { ...next, contents: { ...next.contents, [cardId]: content } };
      resizedContent ||= Boolean(stored);
      next = updateCardLayoutItem(next, layoutCards, viewport, cardId, {
        ...next.positions[cardId], height: Math.max(next.positions[cardId].height, Math.ceil(height / 48) * 48),
      });
    }
    if (next !== latestLayoutRef.current) {
      applyWorkingLayout(next);
      if (resizedContent && !gestureRef.current) onLayoutChange?.(next);
    }
  }, [layoutEditing, layoutCards, savedLayout, viewport, workingLayout, onLayoutChange]);

  useEffect(() => () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); }, []);

  const minimumCardHeight = (cardId: string, element: HTMLElement) => {
    const surface = element.querySelector<HTMLElement>(".glass-card");
    const style = surface ? getComputedStyle(surface) : undefined;
    const padding = style ? Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) : 0;
    return Math.min(1_200, Math.max(defaultCardHeight(layoutCards.find(card => card.id === cardId)!), (activeLayout.contents?.[cardId]?.height || 0) + padding));
  };

  const startGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!layoutEditing || event.button !== 0) return;
    const target = event.target as HTMLElement;
    const cardElement = target.closest<HTMLElement>("[data-card-layout-item]");
    if (!cardElement) return;
    const cardId = cardElement.dataset.cardLayoutItem;
    if (!cardId) return;

    const contentElement = target.closest<HTMLElement>("[data-card-content-layout-item]");
    const contentCanvas = contentElement?.closest<HTMLElement>("[data-card-content-layout]");
    const cardControl = target.closest<HTMLElement>("[data-page-card-layout-mode]");
    if (!contentElement && !cardControl) return;

    const scope: Gesture["scope"] = contentElement ? "content" : "card";
    const mode = (target.closest<HTMLElement>("[data-card-layout-mode], [data-page-card-layout-mode]")?.dataset.cardLayoutMode
      || target.closest<HTMLElement>("[data-page-card-layout-mode]")?.dataset.pageCardLayoutMode
      || "move") as Gesture["mode"];
    const item = contentElement?.dataset.cardContentLayoutItem as CardContentLayoutItem | undefined;
    const contentLayout = item ? normalizeCardContentLayout(activeLayout.contents?.[cardId]) : undefined;
    const canvas = scope === "content" ? contentCanvas : event.currentTarget;
    const startRect = scope === "content" && item
      ? contentLayout!.positions[item]
      : activeLayout.positions[cardId];
    if (!canvas || !startRect) return;

    event.preventDefault();
    event.stopPropagation();
    const bounds = canvas.getBoundingClientRect();
    gestureRef.current = {
      scope,
      cardId,
      item,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: { ...startRect },
      layout: activeLayout,
      contentLayout,
      bounds,
      scale: Math.max(.01, bounds.width / canvas.offsetWidth),
      minimumHeight: minimumCardHeight(cardId, cardElement),
    };
    latestLayoutRef.current = activeLayout;
    pendingLayoutRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveTarget({ scope, cardId, item });
  };

  const updateGesturePosition = (event: { clientX: number; clientY: number; pointerId: number }) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - gesture.startX) / gesture.bounds.width * 100;
    const deltaY = (event.clientY - gesture.startY) / gesture.scale;
    const defaultWidth = gesture.scope === "card" ? layoutCards.find((card) => card.id === gesture.cardId)?.defaultRect?.width : undefined;
    const rect = gesture.mode === "move"
      ? { ...gesture.startRect, x: gesture.startRect.x + deltaX, y: gesture.startRect.y + deltaY }
      : gesture.scope === "card"
        ? snapCardLayoutSize({ ...gesture.startRect, width: gesture.startRect.width + deltaX, height: gesture.startRect.height + deltaY }, defaultWidth, gesture.minimumHeight)
        : { ...gesture.startRect, width: gesture.startRect.width + deltaX, height: gesture.startRect.height + deltaY };
    const positions = gesture.scope === "content" ? gesture.contentLayout!.positions : gesture.layout.positions;
    const height = gesture.scope === "content" ? gesture.contentLayout!.height : gesture.layout.height;
    const itemId = gesture.scope === "content" ? gesture.item! : gesture.cardId;
    const snapped = alignCardLayoutRect(positions, height, itemId, rect, gesture.mode, 6 / gesture.bounds.width * 100, 6 / gesture.scale);
    const update = (nextRect: CardLayoutRect, allowOverlap = false) => gesture.scope === "content"
      ? updateCardContentLayoutItem(gesture.layout, layoutCards, viewport, gesture.cardId, gesture.item!, nextRect, allowOverlap)
      : updateCardLayoutItem(gesture.layout, layoutCards, viewport, gesture.cardId, nextRect, allowOverlap);
    const alignedRect = snapped.guides.x !== undefined || snapped.guides.y !== undefined ? snapped.rect : rect;
    const keepCardSize = gesture.scope === "card" && gesture.mode === "resize";
    pendingLayoutRef.current = update(keepCardSize ? { ...alignedRect, width: rect.width, height: rect.height } : alignedRect);
    setGuides({ ...snapped.guides, ...(keepCardSize ? { x: undefined, y: undefined } : {}), scope: gesture.scope, cardId: gesture.cardId });
    applyWorkingLayout(pendingLayoutRef.current);
  };

  const updateGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gestureRef.current || gestureRef.current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    pointerRef.current = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId };
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (pointerRef.current) updateGesturePosition(pointerRef.current);
    });
  };

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    updateGesturePosition(event);
    const committedLayout = pendingLayoutRef.current || latestLayoutRef.current;
    gestureRef.current = null;
    pendingLayoutRef.current = null;
    setActiveTarget(null);
    setGuides({});
    applyWorkingLayout(committedLayout);
    onLayoutChange?.(committedLayout);
  };

  const cancelGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    gestureRef.current = null;
    pendingLayoutRef.current = null;
    setActiveTarget(null);
    setGuides({});
    applyWorkingLayout(gesture.layout);
  };

  const handleKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!layoutEditing || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const target = event.target as HTMLElement;
    const cardElement = target.closest<HTMLElement>("[data-card-layout-item]");
    const cardId = cardElement?.dataset.cardLayoutItem;
    if (!cardId) return;
    const contentElement = target.closest<HTMLElement>("[data-card-content-layout-item]");
    const item = contentElement?.dataset.cardContentLayoutItem as CardContentLayoutItem | undefined;
    const scope: Gesture["scope"] = item ? "content" : "card";
    const mode = (target.dataset.cardLayoutMode || target.dataset.pageCardLayoutMode || "move") as Gesture["mode"];
    const contentLayout = item ? normalizeCardContentLayout(activeLayout.contents?.[cardId]) : undefined;
    const currentRect = item ? contentLayout!.positions[item] : activeLayout.positions[cardId];
    if (!currentRect) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 4 : 1;
    const defaultWidth = scope === "card" ? layoutCards.find((card) => card.id === cardId)?.defaultRect?.width : undefined;
    const rect = mode === "move" ? {
      ...currentRect,
      x: currentRect.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
      y: currentRect.y + (event.key === "ArrowUp" ? -step * 4 : event.key === "ArrowDown" ? step * 4 : 0),
    } : {
      ...currentRect,
      width: scope === "card" && (event.key === "ArrowLeft" || event.key === "ArrowRight")
        ? stepCardLayoutWidth(currentRect.width, event.key === "ArrowLeft" ? -1 : 1, defaultWidth)
        : currentRect.width + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
      height: currentRect.height + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) * (scope === "card" ? 48 : 4),
    };
    const sizedRect = mode === "resize" && scope === "card"
      ? snapCardLayoutSize(rect, defaultWidth, minimumCardHeight(cardId, cardElement!))
      : rect;
    const next = scope === "content"
      ? updateCardContentLayoutItem(activeLayout, layoutCards, viewport, cardId, item!, sizedRect)
      : updateCardLayoutItem(activeLayout, layoutCards, viewport, cardId, sizedRect);
    applyWorkingLayout(next);
    onLayoutChange?.(next);
  };

  const cardClassName = (link: LinkData, selected: boolean, editing: boolean) => (
    `content-card-variant-${links.indexOf(link) % 6} public-editor-target public-editor-target--link${selected ? " is-selected" : ""}${editing ? " is-layout-editing" : ""}`
  );

  const cardContent = (link: LinkData) => {
    const storedContent = activeLayout.contents?.[link.id];
    const contentLayout = supportsContentLayout(link) && storedContent
      ? normalizeCardContentLayout(storedContent)
      : undefined;
    return (
      <PublicBlockRenderer
        cardContentLayout={contentLayout}
        cardContentLayoutEditing={layoutEditing && Boolean(contentLayout)}
        cardContentLayoutGuides={guides.scope === "content" && guides.cardId === link.id ? guides : undefined}
        link={link}
      />
    );
  };

  if (!useFreeLayout) {
    return (
      <div className="public-card-stack flex flex-col" style={{ gap: "var(--card-spacing)" }}>
        {links.map((link) => (
          <div
            aria-label={onEditorSelect ? `Edit ${link.title || "content block"}` : undefined}
            className={cardClassName(link, editorSelection?.kind === "link" && editorSelection.id === link.id, false)}
            data-public-editor-link-id={onEditorSelect ? link.id : undefined}
            data-public-editor-target={onEditorSelect ? "link" : undefined}
            data-surface-effect={link.surfaceEffect && link.surfaceEffect !== "inherit" ? link.surfaceEffect : theme.contentCardEffect}
            key={link.id}
            onClickCapture={onEditorSelect ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onEditorSelect({ kind: "link", id: link.id });
            } : undefined}
            onKeyDown={onEditorSelect ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onEditorSelect({ kind: "link", id: link.id });
            } : undefined}
            role={onEditorSelect ? "button" : undefined}
            style={getContentCardVariantCssVariables(theme, links.indexOf(link)) as CSSProperties}
            tabIndex={onEditorSelect ? 0 : undefined}
          >
            {cardContent(link)}
          </div>
        ))}
      </div>
    );
  }

  const orderedCards = layoutEditing ? layoutCards : [...layoutCards].sort((left, right) => {
    const a = activeLayout.positions[left.id];
    const b = activeLayout.positions[right.id];
    return a.y - b.y || a.x - b.x;
  });

  return (
    <div
      className={`public-card-stack public-card-stack--layout${layoutEditing ? " public-card-stack--layout-editing" : ""}`}
      ref={canvasRef}
      data-card-layout-viewport={viewport}
      onClick={layoutEditing ? (event) => { event.preventDefault(); event.stopPropagation(); } : undefined}
      onKeyDown={handleKeyboard}
      onPointerCancel={cancelGesture}
      onPointerDown={startGesture}
      onPointerMove={updateGesture}
      onPointerUp={finishGesture}
      style={{ "--page-card-layout-height": `${activeLayout.height}px` } as CSSProperties}
    >
      {orderedCards.map((card) => {
        const rect = activeLayout.positions[card.id];
        if (card.id === PROFILE_CARD_LAYOUT_ID) {
          const active = activeTarget?.scope === "card" && activeTarget.cardId === card.id;
          return (
            <div
              className={`page-card-layout__item page-card-layout__item--profile${active ? " is-dragging" : ""}`}
              data-card-layout-item={card.id}
              data-card-layout-position={`${rect.x},${rect.y},${rect.width},${rect.height}`}
              key={card.id}
              style={{
                "--page-card-layout-x": `${rect.x}%`,
                "--page-card-layout-y": `${rect.y}px`,
                "--page-card-layout-width": `${rect.width}%`,
                "--page-card-layout-item-height": `${rect.height}px`,
              } as CSSProperties}
            >
              {layoutEditing && (
              <button aria-label={tr("Move profile card", "Sposta card profilo")} className="page-card-layout__grip page-card-layout__grip--profile" data-page-card-layout-mode="move" onClick={(event) => event.stopPropagation()} title={tr("Drag the profile card. Other cards move out of the way.", "Trascina la card profilo. Le altre card si spostano automaticamente.")} type="button"><GripVertical aria-hidden="true" size={17} /></button>
              )}
              <div className="page-card-layout__surface page-card-layout__surface--profile">{profileCard?.content}</div>
              {layoutEditing && (
                <button aria-label={tr("Resize profile card", "Ridimensiona card profilo")} className="page-card-layout__resize" data-page-card-layout-mode="resize" onClick={(event) => event.stopPropagation()} title={tr("Drag to resize the whole profile.", "Trascina per ridimensionare l’intero profilo.")} type="button"><MoveDiagonal2 aria-hidden="true" size={17} /></button>
              )}
            </div>
          );
        }
        const link = card as LinkData;
        const selected = editorSelection?.kind === "link" && editorSelection.id === link.id;
        const active = activeTarget?.scope === "card" && activeTarget.cardId === link.id;
        return (
          <div
            aria-label={onEditorSelect && !layoutEditing ? `Edit ${link.title || "content block"}` : undefined}
            className={`${cardClassName(link, selected, layoutEditing)} page-card-layout__item${active ? " is-dragging" : ""}`}
            data-card-layout-item={link.id}
            data-card-layout-position={`${rect.x},${rect.y},${rect.width},${rect.height}`}
            data-public-editor-link-id={onEditorSelect ? link.id : undefined}
            data-public-editor-target={onEditorSelect ? "link" : undefined}
            key={link.id}
            onClickCapture={onEditorSelect && !layoutEditing ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onEditorSelect({ kind: "link", id: link.id });
            } : undefined}
            onKeyDown={onEditorSelect && !layoutEditing ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onEditorSelect({ kind: "link", id: link.id });
            } : undefined}
            role={onEditorSelect && !layoutEditing ? "button" : undefined}
            style={{
              ...getContentCardVariantCssVariables(theme, links.indexOf(link)),
              "--page-card-layout-x": `${rect.x}%`,
              "--page-card-layout-y": `${rect.y}px`,
              "--page-card-layout-width": `${rect.width}%`,
              "--page-card-layout-item-height": `${rect.height}px`,
            } as CSSProperties}
            tabIndex={onEditorSelect && !layoutEditing ? 0 : undefined}
          >
            {layoutEditing && (
              <button aria-label={`${tr("Move card", "Sposta card")} ${link.title || tr("content block", "blocco contenuto")}`} className="page-card-layout__grip" data-page-card-layout-mode="move" onClick={(event) => event.stopPropagation()} title={tr("Drag the card. Other cards move out of the way.", "Trascina la card. Le altre card si spostano automaticamente.")} type="button"><GripVertical aria-hidden="true" size={17} /></button>
            )}
            <div className="page-card-layout__surface" data-surface-effect={link.surfaceEffect && link.surfaceEffect !== "inherit" ? link.surfaceEffect : theme.contentCardEffect}>{cardContent(link)}</div>
            {layoutEditing && (
              <button aria-label={`${tr("Resize card", "Ridimensiona card")} ${link.title || tr("content block", "blocco contenuto")}`} className="page-card-layout__resize" data-page-card-layout-mode="resize" onClick={(event) => event.stopPropagation()} title={tr("Drag to choose a preset card size.", "Trascina per scegliere una dimensione predefinita della card.")} type="button"><MoveDiagonal2 aria-hidden="true" size={17} /></button>
            )}
          </div>
        );
      })}
      {layoutEditing && guides.scope === "card" && guides.x !== undefined && <i className="page-card-layout__guide page-card-layout__guide--x" style={{ left: `${guides.x}%` }} />}
      {layoutEditing && guides.scope === "card" && guides.y !== undefined && <i className="page-card-layout__guide page-card-layout__guide--y" style={{ top: `${guides.y}px` }} />}
    </div>
  );
}
