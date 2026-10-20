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
import { flushSync } from "react-dom";
import { GripVertical, MoveDiagonal2 } from "lucide-react";

import type { LinkData } from "./LinkCard";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import type { PublicEditorTarget } from "./PublicView";
import {
  alignCardLayoutRect,
  fitCardLayoutHeights,
  hasCardLayoutOverlap,
  normalizeCardLayout,
  PROFILE_CARD_LAYOUT_ID,
  updateCardLayoutItem,
  type CardLayout,
  type CardLayoutGuides,
  type CardLayoutRect,
  type CardLayoutSource,
  type CardLayoutViewport,
  type NormalizedCardLayout,
} from "@/lib/card-layout";
import { getContentCardVariantCssVariables, type ThemeConfig } from "@/lib/theme";
import { useAppI18n } from "@/lib/i18n";
import { useLayoutOverlapWarning } from "@/hooks/use-layout-overlap-warning";

interface PublicCardLayoutProps {
  links: LinkData[];
  theme: ThemeConfig;
  layout?: CardLayout | null;
  viewport: CardLayoutViewport;
  layoutEditing?: boolean;
  editorSelection?: PublicEditorTarget | null;
  onEditorSelect?: (target: PublicEditorTarget) => void;
  onLayoutChange?: (layout: CardLayout) => void;
  profileCard?: { content: ReactNode; height: number; minHeight: number };
  desktopDefaultWidthCapRem?: number;
}

type Gesture = {
  rejected?: boolean;
  warned?: boolean;
  cardId: string;
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  startRect: CardLayoutRect;
  layout: NormalizedCardLayout;
  bounds: DOMRect;
  scale: number;
  scrollContainer: HTMLElement | null;
  scrollTop: number;
  windowScrollY: number;
};

function measureCardHeights(canvas: HTMLElement) {
  const heights: Record<string, number> = {};
  canvas.querySelectorAll<HTMLElement>("[data-card-layout-item]").forEach(item => {
    const surface = item.querySelector<HTMLElement>(".page-card-layout__surface");
    if (!surface) return;
    const card = surface.querySelector<HTMLElement>(".glass-card, .public-cta-card") || surface.firstElementChild as HTMLElement;
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    const style = getComputedStyle(card);
    const scale = bounds.width / Number.parseFloat(style.width);
    if (!scale) return;
    const children = Array.from(card.children).filter(child => !["absolute", "fixed"].includes(getComputedStyle(child).position));
    // An anchored bio's automatic margin fills the manual minimum, not intrinsic content height.
    const bottom = card.querySelector(':scope > .profile-card__fixed-bio')
      ? Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth)
        + children.reduce((sum, child) => sum + child.getBoundingClientRect().height / scale, 0)
        + Number.parseFloat(style.rowGap) * Math.max(0, children.length - 1)
      : Math.max(Number.parseFloat(style.paddingTop), ...children.map(child => {
      const position = getComputedStyle(child).position;
      return position === "absolute" || position === "fixed" ? 0 : (child.getBoundingClientRect().bottom - bounds.top) / scale;
      }));
    // Scaled preview coordinates have subpixel noise, especially in Firefox.
    heights[item.dataset.cardLayoutItem!] = Math.ceil(bottom + Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth) - 0.05);
  });
  return heights;
}

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
  const warnOverlap = useLayoutOverlapWarning();
  const hasProfileCard = profileCard !== undefined;
  const profileCardHeight = profileCard?.height;
  const profileMinHeight = profileCard?.minHeight;
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
      ...links.map((link) => ({ ...link, defaultRect })),
    ];
  }, [desktopDefaultWidthCapRem, hasProfileCard, links, profileCardHeight, theme.maxWidth, viewport]);
  const savedLayout = useMemo(() => ({
    ...normalizeCardLayout(rawLayout, layoutCards, viewport),
    ...(hasProfileCard ? { profileMinHeight } : {}),
  }), [hasProfileCard, layoutCards, profileMinHeight, rawLayout, viewport]);

  const [workingLayout, setWorkingLayout] = useState(savedLayout);
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [guides, setGuides] = useState<CardLayoutGuides>({});
  const [heights, setHeights] = useState<Record<string, number>>({});
  const gestureRef = useRef<Gesture | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef<{ clientX: number; clientY: number; pointerId: number; shiftKey: boolean } | null>(null);
  const latestLayoutRef = useRef<NormalizedCardLayout>(savedLayout);
  const previousSavedStateRef = useRef({ layout: savedLayout, editing: layoutEditing, viewport });
  const useFreeLayout = layoutEditing || Boolean(rawLayout);
  const activeLayout = useMemo(() => fitCardLayoutHeights(
    layoutEditing ? normalizeCardLayout(workingLayout, layoutCards, viewport) : savedLayout, heights, true, hasProfileCard,
  ), [hasProfileCard, heights, layoutCards, layoutEditing, savedLayout, viewport, workingLayout]);

  useLayoutEffect(() => {
    const previous = previousSavedStateRef.current;
    previousSavedStateRef.current = { layout: savedLayout, editing: layoutEditing, viewport };
    // Toast updates can recreate identical layout props while a card is being dragged.
    if (previous.editing === layoutEditing && previous.viewport === viewport && JSON.stringify(previous.layout) === JSON.stringify(savedLayout)) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const pointerId = gestureRef.current?.pointerId;
    gestureRef.current = null;
    pointerRef.current = null;
    if (pointerId !== undefined && canvasRef.current?.hasPointerCapture(pointerId)) canvasRef.current.releasePointerCapture(pointerId);
    setActiveCard(null);
    setGuides({});
    latestLayoutRef.current = savedLayout;
    setWorkingLayout(savedLayout);
  }, [savedLayout, layoutEditing, viewport]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !useFreeLayout) return;
    const measure = () => {
      const next = measureCardHeights(canvas);
      setHeights(previous => Object.keys(next).length === Object.keys(previous).length
        && Object.entries(next).every(([id, height]) => previous[id] === height) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    canvas.querySelectorAll(".page-card-layout__surface, .page-card-layout__surface > *, .page-card-layout__surface .glass-card > *").forEach(surface => observer.observe(surface));
    return () => observer.disconnect();
  }, [layoutCards, profileCard?.content, useFreeLayout]);

  useEffect(() => () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); }, []);

  const applyWorkingLayout = (next: NormalizedCardLayout) => {
    latestLayoutRef.current = next;
    setWorkingLayout(next);
  };

  const startGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!layoutEditing || event.button !== 0 || gestureRef.current) return;
    const target = event.target as HTMLElement;
    const control = target.closest<HTMLElement>("[data-page-card-layout-mode]");
    const cardId = control?.closest<HTMLElement>("[data-card-layout-item]")?.dataset.cardLayoutItem;
    if (!control || !cardId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    event.preventDefault();
    event.stopPropagation();
    control.focus({ preventScroll: true });
    const scrollContainer = event.currentTarget.closest<HTMLElement>(".admin-live-preview__scroll");
    gestureRef.current = {
      cardId,
      mode: control.dataset.pageCardLayoutMode as Gesture["mode"],
      pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY,
      startRect: { ...activeLayout.positions[cardId] },
      layout: activeLayout, bounds,
      scale: bounds.width / event.currentTarget.offsetWidth,
      scrollContainer, scrollTop: scrollContainer?.scrollTop || 0, windowScrollY: window.scrollY,
    };
    applyWorkingLayout(activeLayout);
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveCard(cardId);
  };

  const updateGesturePosition = (event: { clientX: number; clientY: number; pointerId: number; shiftKey: boolean }) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.rejected) return;
    const deltaX = (event.clientX - gesture.startX) / gesture.bounds.width * 100;
    const deltaY = (event.clientY - gesture.startY + window.scrollY - gesture.windowScrollY) / gesture.scale
      + (gesture.scrollContainer?.scrollTop || 0) - gesture.scrollTop;
    const rect = gesture.mode === "move"
      ? { ...gesture.startRect, x: gesture.startRect.x + deltaX, y: gesture.startRect.y + deltaY }
      : { ...gesture.startRect, width: gesture.startRect.width + deltaX, height: gesture.startRect.height + deltaY };
    const aligned = alignCardLayoutRect(gesture.layout.positions, gesture.layout.height, gesture.cardId, rect, gesture.mode, 4 / gesture.bounds.width * 100, 4 / gesture.scale);
    // Guides are advisory; only Shift opts into snapping.
    const candidate = event.shiftKey ? aligned.rect : rect;
    if (gesture.mode === "resize") candidate.width = Math.min(candidate.width, 100 - candidate.x);
    const next = fitCardLayoutHeights(
      updateCardLayoutItem(gesture.layout, layoutCards, viewport, gesture.cardId, candidate, gesture.mode), heights, false, hasProfileCard,
    );
    gesture.rejected = hasCardLayoutOverlap(next.positions, gesture.cardId);
    if (gesture.rejected) {
      applyWorkingLayout(gesture.layout);
      setGuides({});
      if (!gesture.warned) { warnOverlap(); gesture.warned = true; }
      return;
    }
    // Shrinking the canvas during a drag clamps scrollTop and moves the card again.
    next.height = Math.max(next.height, gesture.layout.height);
    setGuides(aligned.guides);
    applyWorkingLayout(next);
  };

  const renderGestureFrame = () => {
    frameRef.current = null;
    const gesture = gestureRef.current;
    const pointer = pointerRef.current;
    if (!gesture || gesture.rejected || !pointer) return;
    const scroll = gesture.scrollContainer;
    let scrolled = false;
    if (scroll) {
      const bounds = scroll.getBoundingClientRect();
      const edge = 36;
      const direction = pointer.clientY < bounds.top + edge ? -1 : pointer.clientY > bounds.bottom - edge ? 1 : 0;
      const previous = scroll.scrollTop;
      scroll.scrollTop += direction * 12 / gesture.scale;
      scrolled = scroll.scrollTop !== previous;
    }
    updateGesturePosition(pointer);
    if (scrolled) frameRef.current = requestAnimationFrame(renderGestureFrame);
  };

  const updateGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gestureRef.current || gestureRef.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    pointerRef.current = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId, shiftKey: event.shiftKey };
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(renderGestureFrame);
  };

  const resetGesture = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    gestureRef.current = null;
    pointerRef.current = null;
    setActiveCard(null);
    setGuides({});
  };

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    // Measure the final width before committing: wrapping can make a resized card taller.
    flushSync(() => updateGesturePosition(event));
    const completed = fitCardLayoutHeights(latestLayoutRef.current, measureCardHeights(event.currentTarget), false, hasProfileCard);
    const rejected = gesture.rejected || hasCardLayoutOverlap(completed.positions, gesture.cardId);
    const next = rejected ? gesture.layout : normalizeCardLayout(completed, layoutCards, viewport);
    resetGesture();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    applyWorkingLayout(next);
    if (rejected) { if (!gesture.warned) warnOverlap(); return; }
    if (next.profileMinHeight !== gesture.layout.profileMinHeight || JSON.stringify(next.positions) !== JSON.stringify(gesture.layout.positions)) onLayoutChange?.(next);
  };

  const cancelGesture = (event?: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || (event && gesture.pointerId !== event.pointerId)) return;
    resetGesture();
    if (canvasRef.current?.hasPointerCapture(gesture.pointerId)) canvasRef.current.releasePointerCapture(gesture.pointerId);
    applyWorkingLayout(gesture.layout);
  };

  const handleKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!layoutEditing) return;
    if (event.key === "Escape" && gestureRef.current) {
      event.preventDefault();
      event.stopPropagation();
      cancelGesture();
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const control = (event.target as HTMLElement).closest<HTMLElement>("[data-page-card-layout-mode]");
    const cardId = control?.closest<HTMLElement>("[data-card-layout-item]")?.dataset.cardLayoutItem;
    if (!control || !cardId || !canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = activeLayout.positions[cardId];
    const step = event.shiftKey ? 10 : 1;
    const dx = (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0) / canvasRef.current.offsetWidth * 100;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    const mode = control.dataset.pageCardLayoutMode as Gesture["mode"];
    const candidate = mode === "resize"
      ? { ...rect, width: Math.min(100 - rect.x, rect.width + dx), height: rect.height + dy }
      : { ...rect, x: rect.x + dx, y: rect.y + dy };
    const proposed = fitCardLayoutHeights(
      updateCardLayoutItem(activeLayout, layoutCards, viewport, cardId, candidate, mode), heights, false, hasProfileCard,
    );
    if (hasCardLayoutOverlap(proposed.positions, cardId)) { warnOverlap(); return; }
    flushSync(() => applyWorkingLayout(proposed));
    const measured = fitCardLayoutHeights(proposed, measureCardHeights(canvasRef.current), false, hasProfileCard);
    if (hasCardLayoutOverlap(measured.positions, cardId)) {
      applyWorkingLayout(activeLayout);
      warnOverlap();
      return;
    }
    const next = normalizeCardLayout(measured, layoutCards, viewport);
    applyWorkingLayout(next);
    onLayoutChange?.(next);
  };

  const cardClassName = (link: LinkData, selected: boolean, editing: boolean) => (
    `content-card-variant-${links.indexOf(link) % 6} public-editor-target public-editor-target--link${selected ? " is-selected" : ""}${editing ? " is-layout-editing" : ""}`
  );

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
            {<PublicBlockRenderer link={link} />}
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
      onClickCapture={layoutEditing ? (event) => {
        if ((event.target as HTMLElement).closest('[data-profile-layout-editor="true"]')) return;
        event.preventDefault(); event.stopPropagation();
      } : undefined}
      onKeyDown={handleKeyboard}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={cancelGesture}
      onPointerDown={startGesture}
      onPointerMove={updateGesture}
      onPointerUp={finishGesture}
      style={{ "--page-card-layout-height": `${activeLayout.height}px` } as CSSProperties}
    >
      {orderedCards.map((card) => {
        const rect = activeLayout.positions[card.id];
        if (card.id === PROFILE_CARD_LAYOUT_ID) {
          const active = activeCard === card.id;
          return (
            <div
              className={`page-card-layout__item page-card-layout__item--profile${active ? " is-dragging" : ""}`}
              data-card-layout-item={card.id}
              data-card-layout-position={`${rect.x},${rect.y},${rect.width},${rect.height}`}
              key={card.id}
              style={{
                zIndex: active ? layoutCards.length + 1 : layoutCards.indexOf(card) + 1,
                "--page-card-layout-x": `${rect.x}%`,
                "--page-card-layout-y": `${rect.y}px`,
                "--page-card-layout-width": `${rect.width}%`,
                "--page-card-layout-item-height": `${rect.height}px`,
              } as CSSProperties}
            >
              {layoutEditing && (
              <button aria-label={tr("Move profile card", "Sposta card profilo")} className="page-card-layout__grip page-card-layout__grip--profile" data-page-card-layout-mode="move" onClick={(event) => event.stopPropagation()} title={tr("Drag the profile card. Other cards keep their positions.", "Trascina la card profilo. Le altre card mantengono la loro posizione.")} type="button"><GripVertical aria-hidden="true" size={17} /></button>
              )}
              <div className="page-card-layout__surface page-card-layout__surface--profile">{profileCard?.content}</div>
              {layoutEditing && (
                <button aria-label={tr("Resize profile card", "Ridimensiona card profilo")} className="page-card-layout__resize" data-page-card-layout-mode="resize" onClick={(event) => event.stopPropagation()} title={tr("Drag to resize the whole profile.", "Trascina per ridimensionare l’intero profilo.")} type="button"><MoveDiagonal2 aria-hidden="true" size={17} /></button>
              )}
            </div>
          );
        }
        const link = links.find(link => link.id === card.id)!;
        const selected = editorSelection?.kind === "link" && editorSelection.id === link.id;
        const active = activeCard === link.id;
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
              zIndex: active ? layoutCards.length + 1 : layoutCards.indexOf(card) + 1,
                "--page-card-layout-x": `${rect.x}%`,
              "--page-card-layout-y": `${rect.y}px`,
              "--page-card-layout-width": `${rect.width}%`,
              "--page-card-layout-item-height": `${rect.height}px`,
            } as CSSProperties}
            tabIndex={onEditorSelect && !layoutEditing ? 0 : undefined}
          >
            {layoutEditing && (
              <button aria-label={`${tr("Move card", "Sposta card")} ${link.title || tr("content block", "blocco contenuto")}`} className="page-card-layout__grip" data-page-card-layout-mode="move" onClick={(event) => event.stopPropagation()} title={tr("Drag the card. Other cards keep their positions.", "Trascina la card. Le altre card mantengono la loro posizione.")} type="button"><GripVertical aria-hidden="true" size={17} /></button>
            )}
            <div {...{ inert: layoutEditing ? "" : undefined }} className="page-card-layout__surface" data-surface-effect={link.surfaceEffect && link.surfaceEffect !== "inherit" ? link.surfaceEffect : theme.contentCardEffect}>{<PublicBlockRenderer link={link} />}</div>
            {layoutEditing && (
              <button aria-label={`${tr("Resize card", "Ridimensiona card")} ${link.title || tr("content block", "blocco contenuto")}`} className="page-card-layout__resize" data-page-card-layout-mode="resize" onClick={(event) => event.stopPropagation()} title={tr("Drag to resize freely.", "Trascina per ridimensionare liberamente.")} type="button"><MoveDiagonal2 aria-hidden="true" size={17} /></button>
            )}
          </div>
        );
      })}
      {layoutEditing && guides.x !== undefined && <i className="page-card-layout__guide page-card-layout__guide--x" style={{ left: `${guides.x}%` }} />}
      {layoutEditing && guides.y !== undefined && <i className="page-card-layout__guide page-card-layout__guide--y" style={{ top: `${guides.y}px` }} />}
    </div>
  );
}
