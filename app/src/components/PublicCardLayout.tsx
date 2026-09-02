import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { GripVertical } from "lucide-react";

import type { LinkData } from "./LinkCard";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import type { PublicEditorTarget } from "./PublicView";
import {
  alignCardLayoutRect,
  dockDesktopCards,
  normalizeCardContentLayout,
  normalizeCardLayout,
  updateCardContentLayoutItem,
  updateCardLayoutItem,
  type CardContentLayoutItem,
  type CardLayout,
  type CardLayoutGuides,
  type CardLayoutRect,
  type CardLayoutViewport,
  type NormalizedCardContentLayout,
  type NormalizedCardLayout,
} from "@/lib/card-layout";
import { getContentCardVariantCssVariables, type ThemeConfig } from "@/lib/theme";
import { useAppI18n } from "@/lib/i18n";

interface PublicCardLayoutProps {
  links: LinkData[];
  theme: ThemeConfig;
  layout?: CardLayout | null;
  viewport: CardLayoutViewport;
  layoutEditing?: boolean;
  editorSelection?: PublicEditorTarget | null;
  onEditorSelect?: (target: PublicEditorTarget) => void;
  onLayoutChange?: (layout: CardLayout) => void;
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
};

type ActiveTarget = { scope: Gesture["scope"]; cardId: string; item?: CardContentLayoutItem } | null;
type ActiveGuides = CardLayoutGuides & { scope?: Gesture["scope"]; cardId?: string };

const supportsContentLayout = (link: LinkData) => !link.type || link.type === "link";

export function PublicCardLayout({
  links,
  theme,
  layout: rawLayout,
  viewport,
  layoutEditing = false,
  editorSelection,
  onEditorSelect,
  onLayoutChange,
}: PublicCardLayoutProps) {
  const { tr } = useAppI18n();
  const savedLayout = useMemo(() => normalizeCardLayout(rawLayout, links, viewport), [links, rawLayout, viewport]);
  const [workingLayout, setWorkingLayout] = useState(savedLayout);
  const [activeTarget, setActiveTarget] = useState<ActiveTarget>(null);
  const [guides, setGuides] = useState<ActiveGuides>({});
  const gestureRef = useRef<Gesture | null>(null);
  const latestLayoutRef = useRef<NormalizedCardLayout>(workingLayout);
  const useFreeLayout = layoutEditing || Boolean(rawLayout);
  const activeLayout = layoutEditing ? workingLayout : savedLayout;

  useEffect(() => {
    if (gestureRef.current) return;
    latestLayoutRef.current = savedLayout;
    setWorkingLayout(savedLayout);
  }, [savedLayout]);

  const applyWorkingLayout = (next: NormalizedCardLayout) => {
    latestLayoutRef.current = next;
    setWorkingLayout(next);
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
    };
    latestLayoutRef.current = activeLayout;
    target.setPointerCapture?.(event.pointerId);
    setActiveTarget({ scope, cardId, item });
  };

  const updateGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaX = (event.clientX - gesture.startX) / gesture.bounds.width * 100;
    const deltaY = (event.clientY - gesture.startY) / gesture.scale;
    const rect = gesture.mode === "move"
      ? { ...gesture.startRect, x: gesture.startRect.x + deltaX, y: gesture.startRect.y + deltaY }
      : { ...gesture.startRect, width: gesture.startRect.width + deltaX, height: gesture.startRect.height + deltaY };
    if (gesture.scope === "card" && gesture.mode === "move" && viewport === "desktop") {
      const centerY = rect.y + rect.height / 2;
      const target = Object.entries(gesture.layout.positions)
        .filter(([id]) => id !== gesture.cardId)
        .map(([id, position]) => ({
          id,
          position,
          distance: Math.abs(position.y + position.height / 2 - centerY),
          separated: position.x + position.width <= rect.x + 2 || rect.x + rect.width <= position.x + 2,
        }))
        .filter(({ separated }) => gesture.startRect.width > 50 || separated)
        .sort((left, right) => left.distance - right.distance)[0];
      const intentionalDock = Math.abs(deltaX) >= (gesture.startRect.width > 50 ? 12 : 4);
      if (target && intentionalDock && target.distance <= Math.max(rect.height, target.position.height) + 24) {
        setGuides({ x: 50, y: target.position.y, scope: "card", cardId: gesture.cardId });
        applyWorkingLayout(dockDesktopCards(
          gesture.layout,
          links,
          gesture.cardId,
          target.id,
          rect.x + rect.width / 2 < target.position.x + target.position.width / 2 ? "left" : "right",
        ));
        return;
      }
    }
    const positions = gesture.scope === "content" ? gesture.contentLayout!.positions : gesture.layout.positions;
    const height = gesture.scope === "content" ? gesture.contentLayout!.height : gesture.layout.height;
    const itemId = gesture.scope === "content" ? gesture.item! : gesture.cardId;
    const snapped = alignCardLayoutRect(positions, height, itemId, rect, gesture.mode, 6 / gesture.bounds.width * 100, 6 / gesture.scale);
    setGuides({ ...snapped.guides, scope: gesture.scope, cardId: gesture.cardId });
    applyWorkingLayout(gesture.scope === "content"
      ? updateCardContentLayoutItem(gesture.layout, links, viewport, gesture.cardId, gesture.item!, snapped.rect)
      : updateCardLayoutItem(gesture.layout, links, viewport, gesture.cardId, snapped.rect));
  };

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    gestureRef.current = null;
    setActiveTarget(null);
    setGuides({});
    onLayoutChange?.(latestLayoutRef.current);
  };

  const cancelGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
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
    const rect = mode === "move" ? {
      ...currentRect,
      x: currentRect.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
      y: currentRect.y + (event.key === "ArrowUp" ? -step * 4 : event.key === "ArrowDown" ? step * 4 : 0),
    } : {
      ...currentRect,
      width: currentRect.width + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
      height: currentRect.height + (event.key === "ArrowUp" ? -step * 4 : event.key === "ArrowDown" ? step * 4 : 0),
    };
    const next = scope === "content"
      ? updateCardContentLayoutItem(activeLayout, links, viewport, cardId, item!, rect)
      : updateCardLayoutItem(activeLayout, links, viewport, cardId, rect);
    applyWorkingLayout(next);
    onLayoutChange?.(next);
  };

  const cardClassName = (link: LinkData, selected: boolean, editing: boolean) => (
    `content-card-variant-${links.indexOf(link) % 6} public-editor-target public-editor-target--link${selected ? " is-selected" : ""}${editing ? " is-layout-editing" : ""}`
  );

  const cardContent = (link: LinkData) => {
    const storedContent = activeLayout.contents?.[link.id];
    const contentLayout = supportsContentLayout(link) && (layoutEditing || storedContent)
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

  const orderedLinks = [...links].sort((left, right) => {
    const a = activeLayout.positions[left.id];
    const b = activeLayout.positions[right.id];
    return a.y - b.y || a.x - b.x;
  });

  return (
    <div
      className={`public-card-stack public-card-stack--layout${layoutEditing ? " public-card-stack--layout-editing" : ""}`}
      data-card-layout-viewport={viewport}
      onClick={layoutEditing ? (event) => { event.preventDefault(); event.stopPropagation(); } : undefined}
      onKeyDown={handleKeyboard}
      onPointerCancel={cancelGesture}
      onPointerDown={startGesture}
      onPointerMove={updateGesture}
      onPointerUp={finishGesture}
      style={{ "--page-card-layout-height": `${activeLayout.height}px` } as CSSProperties}
    >
      {orderedLinks.map((link) => {
        const rect = activeLayout.positions[link.id];
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
              <button aria-label={`${tr("Move card", "Sposta card")} ${link.title || tr("content block", "blocco contenuto")}`} className="page-card-layout__grip" data-page-card-layout-mode="move" onClick={(event) => event.stopPropagation()} title={tr("Drag the card freely. Use arrow keys for precise movement.", "Trascina liberamente la card. Usa le frecce per movimenti precisi.")} type="button"><GripVertical aria-hidden="true" size={17} /></button>
            )}
            <div className="page-card-layout__surface" data-surface-effect={link.surfaceEffect && link.surfaceEffect !== "inherit" ? link.surfaceEffect : theme.contentCardEffect}>{cardContent(link)}</div>
            {layoutEditing && (
              <button aria-label={`${tr("Resize card", "Ridimensiona card")} ${link.title || tr("content block", "blocco contenuto")}`} className="page-card-layout__resize" data-page-card-layout-mode="resize" onClick={(event) => event.stopPropagation()} title={tr("Drag to resize the card. Use arrow keys for precision.", "Trascina per ridimensionare la card. Usa le frecce per la precisione.")} type="button"><span aria-hidden="true" /></button>
            )}
          </div>
        );
      })}
      {layoutEditing && guides.scope === "card" && guides.x !== undefined && <i className="page-card-layout__guide page-card-layout__guide--x" style={{ left: `${guides.x}%` }} />}
      {layoutEditing && guides.scope === "card" && guides.y !== undefined && <i className="page-card-layout__guide page-card-layout__guide--y" style={{ top: `${guides.y}px` }} />}
    </div>
  );
}
