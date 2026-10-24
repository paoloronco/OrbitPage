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

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GripVertical } from "@/components/ui/material-icons";
import { AlignCenter, AlignLeft, AlignRight, BriefcaseBusiness, Linkedin, Github, Instagram, Facebook, MapPin, MoveDiagonal2, Twitter, Youtube } from "lucide-react";
import { normalizeProfileSocialHref } from "@orbitpage/page-schema";
import { TikTokIcon, DiscordIcon, TelegramIcon, WhatsAppIcon, MastodonIcon } from "./SocialIcons";
import { internalAssetPath, withRuntimeAssetPath } from "@/lib/base-path";
import { resolveSafePublicHref, resolveSafePublicMediaUrl } from "@/lib/browser-network-policy";
import { hasCustomProfileAvatar } from "@/lib/profile-avatar";
import { getProfileAppearanceStyle, getProfileAvatarStyle, type ProfileAppearance } from "@/lib/profile-appearance";
import {
  normalizeVisibleProfileLayout,
  fitVisibleProfileLayout,
  updateProfileLayoutAlignment,
  updateProfileLayoutItem,
  snapProfileLayoutRect,
  type NormalizedProfileLayout,
  type ProfileLayout,
  type ProfileLayoutItem,
  type ProfileLayoutRect,
  type ProfileLayoutViewport,
} from "@/lib/profile-layout";
import { useAppI18n } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CardSurfaceEffect } from "@/lib/theme";
import { alignCardLayoutRect, reflowLayoutItem, PROFILE_CARD_LAYOUT_ID, type CardLayoutGuides } from "@/lib/card-layout";
import { useLayoutOverlapWarning } from "@/hooks/use-layout-overlap-warning";

interface ProfileData {
  name: string;
  bio: string;
  avatar: string;
  showAvatar?: boolean;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    discord?: string;
    telegram?: string;
    whatsapp?: string;
    mastodon?: string;
  };
  nameFontSize?: string;
  bioFontSize?: string;
  appearance?: ProfileAppearance;
}

interface PublicProfileSectionProps {
  profile: ProfileData;
  fallbackName?: string | null;
  surfaceEffect?: CardSurfaceEffect;
  layoutEditing?: boolean;
  layoutViewport?: ProfileLayoutViewport;
  onLayoutChange?: (layout: ProfileLayout) => void;
}

type LayoutGesture = {
  rejected?: boolean;
  item: ProfileLayoutItem;
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  startRect: ProfileLayoutRect;
  layout: NormalizedProfileLayout;
  bounds: DOMRect;
  scale: number;
  minimumWidth: number;
  minimumHeight: number;
  control: HTMLElement;
};

const SOCIALS = [
  { id: "linkedin", label: "LinkedIn profile", icon: Linkedin },
  { id: "github", label: "GitHub profile", icon: Github },
  { id: "instagram", label: "Instagram profile", icon: Instagram },
  { id: "facebook", label: "Facebook profile", icon: Facebook },
  { id: "twitter", label: "X/Twitter profile", icon: Twitter },
  { id: "youtube", label: "YouTube channel", icon: Youtube },
  { id: "tiktok", label: "TikTok profile", icon: TikTokIcon },
  { id: "discord", label: "Discord profile", icon: DiscordIcon },
  { id: "telegram", label: "Telegram profile", icon: TelegramIcon },
  { id: "whatsapp", label: "WhatsApp profile", icon: WhatsAppIcon },
  { id: "mastodon", label: "Mastodon profile", icon: MastodonIcon },
] as const;

const measureProfileItemHeight = (content?: Element | null) =>
  Math.max(0, ...Array.from(content?.children || []).map(child => child.scrollHeight));

const safeProfileLayoutUpdate = (
  layout: NormalizedProfileLayout,
  item: ProfileLayoutItem,
  rect: ProfileLayoutRect,
  visibleItems: ProfileLayoutItem[],
) => {
  const candidate = updateProfileLayoutItem(layout, item, rect);
  const positions = Object.fromEntries(visibleItems.map(id => [id, candidate.positions[id]]));
  const reflowed = reflowLayoutItem({ positions, height: candidate.height }, item, 16, 1_600);
  return reflowed ? { ...candidate, positions: { ...candidate.positions, ...reflowed.positions }, height: Math.max(160, Math.min(2_000, reflowed.height)) } : null;
};

export const PublicProfileSection = ({
  profile,
  fallbackName = "Name or brand",
  surfaceEffect = "solid",
  layoutEditing = false,
  layoutViewport,
  onLayoutChange,
}: PublicProfileSectionProps) => {
  const { tr } = useAppI18n();
  const warnOverlap = useLayoutOverlapWarning();
  const responsiveViewport: ProfileLayoutViewport = useIsMobile() ? "mobile" : "desktop";
  const activeLayoutViewport = layoutViewport || responsiveViewport;
  const resolvedSurfaceEffect = profile.appearance?.surfaceEffect && profile.appearance.surfaceEffect !== "inherit"
    ? profile.appearance.surfaceEffect
    : surfaceEffect;
  const rawLayout = profile.appearance?.layouts?.[activeLayoutViewport] || profile.appearance?.layout;
  const hasCustomLayout = Boolean(
    profile.appearance?.layout ||
    profile.appearance?.layouts?.mobile ||
    profile.appearance?.layouts?.desktop ||
    profile.appearance?.cardLayouts?.[activeLayoutViewport]?.positions?.[PROFILE_CARD_LAYOUT_ID]
  );
  const hasBio = Boolean(profile.bio && profile.bio.trim() !== "");
  const displayName = profile.name?.trim() || fallbackName || "";
  const socialLinks = Object.fromEntries(SOCIALS.map(({ id }) => [id, resolveSafePublicHref(normalizeProfileSocialHref(id, profile.socialLinks?.[id] || ""))])) as Record<typeof SOCIALS[number]["id"], string | null>;
  const hasSocialLinks = Object.values(socialLinks).some(Boolean);
  const profileDetails = profile.appearance?.profileDetails;
  const cardBackgroundImage = getMediaUrl(profile.appearance?.cardBackgroundImage);
  const hasProfileDetails = Boolean(profileDetails?.primary || profileDetails?.secondary);
  const avatarVisible = profile.showAvatar ?? hasCustomProfileAvatar(profile.avatar);
  const visibleLayoutItems = useMemo<ProfileLayoutItem[]>(() => [
    ...(avatarVisible ? ["avatar" as const] : []),
    ...(displayName ? ["name" as const] : []),
    ...(profileDetails?.primary ? ["work" as const] : []),
    ...(profileDetails?.secondary ? ["location" as const] : []),
    ...(hasSocialLinks ? ["socials" as const] : []),
  ], [avatarVisible, displayName, hasSocialLinks, profileDetails?.primary, profileDetails?.secondary]);
  const savedLayout = useMemo(() => normalizeVisibleProfileLayout(rawLayout, visibleLayoutItems), [rawLayout, visibleLayoutItems]);
  const [workingLayout, setWorkingLayout] = useState(savedLayout);
  const [activeItem, setActiveItem] = useState<ProfileLayoutItem | null>(null);
  const [guides, setGuides] = useState<CardLayoutGuides>({});
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  const layoutRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<LayoutGesture | null>(null);
  const pendingLayoutRef = useRef<NormalizedProfileLayout | null>(null);
  const latestLayoutRef = useRef(workingLayout);
  const hasVisibleProfile = Boolean(displayName || hasBio || hasSocialLinks || hasProfileDetails || avatarVisible || layoutEditing);
  const baseLayout = layoutEditing ? workingLayout : savedLayout;
  const layout = useMemo(() => fitVisibleProfileLayout(baseLayout, visibleLayoutItems, contentHeights), [baseLayout, contentHeights, visibleLayoutItems]);
  const compactNameMatch = layout.positions.name.width <= 50 && displayName.match(/^(.*)\s+(\S+)$/);
  const nameLines = compactNameMatch ? [compactNameMatch[1], compactNameMatch[2]] : [displayName];

  useEffect(() => {
    if (!gestureRef.current) {
      latestLayoutRef.current = savedLayout;
      setWorkingLayout(savedLayout);
    }
  }, [savedLayout]);

  useEffect(() => () => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    pendingLayoutRef.current = null;
    if (gesture) {
      latestLayoutRef.current = gesture.layout;
      setWorkingLayout(gesture.layout);
      setActiveItem(null); setGuides({});
    }
    if (gesture?.control.hasPointerCapture(gesture.pointerId)) gesture.control.releasePointerCapture(gesture.pointerId);
  }, [layoutEditing, activeLayoutViewport]);

  const avatar = avatarVisible ? (
    <Avatar className="profile-card__avatar" style={getProfileAvatarStyle(profile.appearance)}>
      <AvatarImage className="object-cover object-center" src={getAvatarUrl(profile.avatar)} alt={profile.name || "Page avatar"} />
      <AvatarFallback delayMs={1_200} className="profile-card__avatar-fallback text-4xl font-bold">{profile.name?.charAt(0) ?? "U"}</AvatarFallback>
    </Avatar>
  ) : null;
  const name = displayName ? (
    <h1
      className={`profile-card__title font-bold${nameLines.length > 1 ? " profile-card__title--stacked" : ""}`}
      style={{ "--profile-name-font-size": profile.nameFontSize || "2rem", fontFamily: "var(--font-profile-name, inherit)" } as CSSProperties}
    >
      {nameLines.map((line, index) => <span key={`${index}-${line}`}>{line}</span>)}
    </h1>
  ) : null;
  const socials = hasSocialLinks ? (
    <div className="profile-card__socials flex flex-wrap justify-center gap-3">
      {SOCIALS.map(({ id, label, icon: Icon }) => socialLinks[id] ? (
        <Button asChild variant="ghost" size="icon" className="profile-card__social h-9 w-9" key={id}>
          <a href={socialLinks[id] || undefined} target="_blank" rel="noopener noreferrer" aria-label={label}>
            <Icon className="h-4 w-4" />
          </a>
        </Button>
      ) : null)}
    </div>
  ) : null;
  const bio = hasBio ? (
    <p
      className="profile-card__bio whitespace-pre-line leading-relaxed"
      style={{ "--profile-bio-font-size": profile.bioFontSize || "1rem", fontFamily: "var(--font-profile-description, inherit)" } as CSSProperties}
    >
      {profile.bio}
    </p>
  ) : null;

  const labels: Record<ProfileLayoutItem, string> = {
    avatar: tr("Profile image", "Immagine profilo"),
    name: tr("Name", "Nome"),
    work: tr("Work", "Lavoro"),
    location: tr("Location", "Luogo"),
    socials: tr("Social links", "Link social"),
    bio: tr("Description", "Descrizione"),
  };
  const contents: Record<ProfileLayoutItem, ReactNode> = {
    avatar: avatar ? <div className="profile-card__avatar-slot flex justify-center">{avatar}</div> : null,
    name,
    work: profileDetails?.primary ? <span className="profile-card__detail inline-flex items-center justify-center gap-1.5"><BriefcaseBusiness className="h-3.5 w-3.5" /><span>{profileDetails.primary}</span></span> : null,
    location: profileDetails?.secondary ? <span className="profile-card__detail inline-flex items-center justify-center gap-1.5"><MapPin className="h-3.5 w-3.5" /><span>{profileDetails.secondary}</span></span> : null,
    socials,
    bio,
  };
  const canvasHeight = Math.max(0, ...visibleLayoutItems
    .map((item) => layout.positions[item].y + layout.positions[item].height));

  useLayoutEffect(() => {
    const canvas = layoutRef.current;
    if (!canvas) return;
    const measure = () => {
      const items = Array.from(canvas.querySelectorAll<HTMLElement>("[data-profile-layout-item]"));
      const heights = Object.fromEntries(items.map(item => [item.dataset.profileLayoutItem!,
        measureProfileItemHeight(item.querySelector(".profile-card__layout-content")),
      ]));
      setContentHeights(previous => Object.keys(previous).length === Object.keys(heights).length
        && Object.entries(heights).every(([id, height]) => previous[id] === height) ? previous : heights);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    canvas.querySelectorAll("[data-profile-layout-item], .profile-card__layout-content > *").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [displayName, hasSocialLinks, layout, layoutEditing, profile.avatar, profile.bio, profile.showAvatar, profileDetails?.primary, profileDetails?.secondary]);

  if (!hasVisibleProfile) return null;

  const applyWorkingLayout = (next: NormalizedProfileLayout) => {
    latestLayoutRef.current = next;
    setWorkingLayout(next);
  };

  const minimumItemSize = (item: ProfileLayoutItem) => {
    const canvas = layoutRef.current;
    const itemElement = canvas?.querySelector<HTMLElement>(`[data-profile-layout-item="${item}"]`);
    const contentElement = itemElement?.querySelector<HTMLElement>(".profile-card__layout-content");
    const avatarSize = Math.min(192, Math.max(56, profile.appearance?.avatarSize ?? 112));
    return {
      width: item === "avatar" && canvas ? Math.min(100, avatarSize / Number.parseFloat(getComputedStyle(canvas).width) * 100) : 12,
      height: item === "avatar" ? avatarSize : Math.max(36, measureProfileItemHeight(contentElement)),
    };
  };

  const startGesture = (
    event: ReactPointerEvent<HTMLElement>,
    item: ProfileLayoutItem,
    mode: LayoutGesture["mode"],
  ) => {
    if (!layoutEditing || item === "bio" || event.button !== 0) return;
    const canvas = layoutRef.current;
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget.tagName === "BUTTON" ? event.currentTarget : canvas).focus({ preventScroll: true });
    const bounds = canvas.getBoundingClientRect();
    const startRect = { ...layout.positions[item] };
    const minimumSize = minimumItemSize(item);
    gestureRef.current = {
      item,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect,
      layout,
      bounds,
      scale: Math.max(.01, bounds.width / Number.parseFloat(getComputedStyle(canvas).width)),
      minimumWidth: minimumSize.width,
      minimumHeight: minimumSize.height,
      control: event.currentTarget,
    };
    latestLayoutRef.current = layout;
    pendingLayoutRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveItem(item);
  };

  const updateGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaX = (event.clientX - gesture.startX) / gesture.bounds.width * 100;
    const deltaY = (event.clientY - gesture.startY) / gesture.scale;
    const rect = gesture.mode === "move"
      ? { ...gesture.startRect, x: gesture.startRect.x + deltaX, y: gesture.startRect.y + deltaY }
      : {
          ...gesture.startRect,
          width: Math.max(gesture.minimumWidth, gesture.startRect.width + deltaX),
          height: Math.max(gesture.minimumHeight, gesture.startRect.height + deltaY),
        };
    const gridRect = event.altKey ? rect : snapProfileLayoutRect(rect, gesture.mode, gesture.bounds.width / gesture.scale);
    if (gesture.mode === "resize") {
      gridRect.width = Math.min(100 - gridRect.x, Math.max(gesture.minimumWidth, gridRect.width));
      gridRect.height = Math.max(gesture.minimumHeight, gridRect.height);
    }
    const snapped = alignCardLayoutRect(
      Object.fromEntries(visibleLayoutItems.map(id => [id, gesture.layout.positions[id]])),
      gesture.layout.height,
      gesture.item,
      gridRect,
      gesture.mode,
      6 / gesture.bounds.width * 100,
      6 / gesture.scale,
      16 / (gesture.bounds.width / gesture.scale) * 100,
      16,
    );
    pendingLayoutRef.current = safeProfileLayoutUpdate(
      gesture.layout,
      gesture.item,
      event.altKey ? rect : snapped.rect,
      visibleLayoutItems,
    );
    gesture.rejected = !pendingLayoutRef.current;
    setGuides(event.altKey ? {} : snapped.guides);
    if (pendingLayoutRef.current) {
      flushSync(() => applyWorkingLayout(pendingLayoutRef.current!));
      const element = layoutRef.current?.querySelector<HTMLElement>(`[data-profile-layout-item="${gesture.item}"] .profile-card__layout-content`);
      const height = measureProfileItemHeight(element);
      const candidate = pendingLayoutRef.current.positions[gesture.item];
      pendingLayoutRef.current = safeProfileLayoutUpdate(pendingLayoutRef.current, gesture.item, { ...candidate, height: Math.max(candidate.height, height) }, visibleLayoutItems);
      gesture.rejected = !pendingLayoutRef.current;
      if (pendingLayoutRef.current) applyWorkingLayout(pendingLayoutRef.current);
    }
    if (!pendingLayoutRef.current) applyWorkingLayout(gesture.layout);
  };

  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const committedLayout = pendingLayoutRef.current || latestLayoutRef.current;
    gestureRef.current = null;
    pendingLayoutRef.current = null;
    setActiveItem(null);
    setGuides({});
    applyWorkingLayout(committedLayout);
    if (gesture.control.hasPointerCapture(gesture.pointerId)) gesture.control.releasePointerCapture(gesture.pointerId);
    if (gesture.rejected) { warnOverlap(); return; }
    onLayoutChange?.(committedLayout);
  };

  const cancelGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    pendingLayoutRef.current = null;
    setActiveItem(null);
    setGuides({});
    applyWorkingLayout(gesture.layout);
  };

  const commitKeyboardChange = (item: ProfileLayoutItem, rect: ProfileLayoutRect) => {
    let next = safeProfileLayoutUpdate(layout, item, rect, visibleLayoutItems);
    if (!next) { warnOverlap(); return; }
    flushSync(() => applyWorkingLayout(next!));
    const element = layoutRef.current?.querySelector<HTMLElement>(`[data-profile-layout-item="${item}"] .profile-card__layout-content`);
    const height = measureProfileItemHeight(element);
    next = safeProfileLayoutUpdate(next, item, { ...next.positions[item], height: Math.max(next.positions[item].height, height) }, visibleLayoutItems);
    if (!next) { applyWorkingLayout(layout); warnOverlap(); return; }
    applyWorkingLayout(next);
    onLayoutChange?.(next);
  };

  const alignItem = (item: ProfileLayoutItem, alignment: "left" | "center" | "right") => {
    const next = updateProfileLayoutAlignment(layout, item, alignment);
    applyWorkingLayout(next);
    onLayoutChange?.(next);
  };

  const moveWithKeyboard = (event: ReactKeyboardEvent, item: ProfileLayoutItem) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = layout.positions[item];
    const step = event.shiftKey ? 8 : 1;
    const dx = step / Number.parseFloat(getComputedStyle(layoutRef.current!).width) * 100;
    commitKeyboardChange(item, {
      ...rect,
      x: rect.x + (event.key === "ArrowLeft" ? -dx : event.key === "ArrowRight" ? dx : 0),
      y: rect.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0),
    });
  };

  const resizeWithKeyboard = (event: ReactKeyboardEvent, item: ProfileLayoutItem) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = layout.positions[item];
    const step = event.shiftKey ? 8 : 1;
    const dx = step / Number.parseFloat(getComputedStyle(layoutRef.current!).width) * 100;
    const minimumSize = minimumItemSize(item);
    commitKeyboardChange(item, {
      ...rect,
      width: Math.min(100 - rect.x, Math.max(minimumSize.width, rect.width + (event.key === "ArrowLeft" ? -dx : event.key === "ArrowRight" ? dx : 0))),
      height: Math.max(minimumSize.height, rect.height + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0)),
    });
  };

  return (
    <Card
      className={`profile-card glass-card p-8 text-center transition-smooth hover:glow-effect${cardBackgroundImage ? " profile-card--has-background-image" : ""}${layoutEditing ? " profile-card--layout-editing" : ""}`}
      data-profile-layout-editor={layoutEditing ? "true" : undefined}
      data-profile-layout-viewport={activeLayoutViewport}
      data-surface-effect={resolvedSurfaceEffect}
      style={getProfileAppearanceStyle(profile.appearance, resolvedSurfaceEffect)}
    >
      {cardBackgroundImage && <img aria-hidden="true" alt="" className="profile-card__background-image" src={cardBackgroundImage} />}
      {cardBackgroundImage && <span aria-hidden="true" className="profile-card__background-overlay" />}
      {hasCustomLayout || layoutEditing ? (
        <div
          className="profile-card__layout profile-card__layout--free"
          ref={layoutRef}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !gestureRef.current) return;
            event.preventDefault(); event.stopPropagation();
            const gesture = gestureRef.current;
            gestureRef.current = null;
            pendingLayoutRef.current = null;
            applyWorkingLayout(gesture.layout);
            setActiveItem(null); setGuides({});
            if (gesture.control.hasPointerCapture(gesture.pointerId)) gesture.control.releasePointerCapture(gesture.pointerId);
          }}
          style={{ "--profile-layout-height": `${canvasHeight}px` } as CSSProperties}
        >
          {visibleLayoutItems.map((item) => {
            const content = contents[item];
            if (!content) return null;
            const rect = layout.positions[item];
            const alignment = layout.alignments[item];
            const canAlignText = item === "name" || item === "work" || item === "location";
            return (
              <div
                className={`profile-card__layout-item profile-card__layout-item--${item}${activeItem === item ? " is-dragging" : ""}`}
                data-profile-layout-align={alignment}
                data-profile-layout-item={item}
                data-profile-layout-position={`${rect.x},${rect.y},${rect.width},${rect.height}`}
                key={item}
                onPointerCancel={cancelGesture}
                onLostPointerCapture={cancelGesture}
                onPointerDown={(event) => {
                  if ((event.target as HTMLElement).closest(".profile-card__layout-grip, .profile-card__layout-resize")) return;
                  startGesture(event, item, "move");
                }}
                onPointerMove={updateGesture}
                onPointerUp={finishGesture}
                style={{
                  "--profile-layout-x": `${rect.x}%`,
                  "--profile-layout-y": `${rect.y}px`,
                  "--profile-layout-width": `${rect.width}%`,
                  "--profile-layout-item-height": `${rect.height}px`,
                } as CSSProperties}
              >
                {layoutEditing && (
                  <button
                    aria-label={`${tr("Move", "Sposta")} ${labels[item]}`}
                    className="profile-card__layout-grip"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => moveWithKeyboard(event, item)}
                    onPointerCancel={cancelGesture}
                    onPointerDown={(event) => startGesture(event, item, "move")}
                    onPointerMove={updateGesture}
                    onPointerUp={finishGesture}
                    title={tr("Drag on the grid; hold Alt to move freely. Arrow keys: 1 px; Shift: 8 px.", "Trascina sulla griglia; tieni Alt per muoverti liberamente. Frecce: 1 px; Maiusc: 8 px.")}
                    type="button"
                  >
                    <GripVertical aria-hidden="true" size={17} />
                  </button>
                )}

                <div {...{ inert: layoutEditing ? "" : undefined }} className="profile-card__layout-content">
                  {content || <span className="profile-card__layout-placeholder">{labels[item]}</span>}
                </div>

                {layoutEditing && canAlignText && (
                  <div className="profile-card__layout-align" role="group" aria-label={`${tr("Align", "Allinea")} ${labels[item]}`} onPointerDown={(event) => event.stopPropagation()}>
                    {([
                      ["left", AlignLeft, tr("Align left", "Allinea a sinistra")],
                      ["center", AlignCenter, tr("Align center", "Allinea al centro")],
                      ["right", AlignRight, tr("Align right", "Allinea a destra")],
                    ] as const).map(([value, Icon, label]) => (
                      <button aria-label={`${label} ${labels[item]}`} className={alignment === value ? "is-active" : undefined} key={value} onClick={(event) => { event.stopPropagation(); alignItem(item, value); }} title={label} type="button"><Icon aria-hidden="true" size={13} /></button>
                    ))}
                  </div>
                )}

                {layoutEditing && (
                  <button
                    aria-label={`${tr("Resize", "Ridimensiona")} ${labels[item]}`}
                    className="profile-card__layout-resize"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => resizeWithKeyboard(event, item)}
                    onPointerCancel={cancelGesture}
                    onPointerDown={(event) => startGesture(event, item, "resize")}
                    onPointerMove={updateGesture}
                    onPointerUp={finishGesture}
                    title={tr("Drag in any direction to resize. Use arrow keys for precision.", "Trascina in ogni direzione per ridimensionare. Usa le frecce per la precisione.")}
                    type="button"
                  >
                    <MoveDiagonal2 aria-hidden="true" size={17} />
                  </button>
                )}
              </div>
            );
          })}
          {layoutEditing && guides.x !== undefined && <i className="profile-card__layout-guide profile-card__layout-guide--x" style={{ left: `${guides.x}%` }} />}
          {layoutEditing && guides.y !== undefined && <i className="profile-card__layout-guide profile-card__layout-guide--y" style={{ top: `${guides.y}px` }} />}
        </div>
      ) : (
        <>
          {avatar && <div className="mb-6 flex justify-center">{avatar}</div>}
          <div className="space-y-4">
            {name && <div className="mb-2">{name}</div>}
            {hasProfileDetails && (
              <div className="profile-card__details text-sm">
                {contents.work}
                {contents.location}
              </div>
            )}
            {socials && <div className="mb-4">{socials}</div>}
            {bio}
          </div>
        </>
      )}
      {(hasCustomLayout || layoutEditing) && bio && <div className="profile-card__fixed-bio" data-profile-layout-fixed="bio">{bio}</div>}
      {layoutEditing && <button className="profile-card__layout-reset" type="button" onClick={(event) => {
        event.stopPropagation();
        const next = normalizeVisibleProfileLayout(undefined, visibleLayoutItems);
        applyWorkingLayout(next);
        onLayoutChange?.(next);
      }}>{tr("Reset profile arrangement", "Ripristina disposizione profilo")}</button>}
    </Card>
  );
};

function getAvatarUrl(avatar?: string | null) {
  return getMediaUrl(avatar) || withRuntimeAssetPath("/brand/orbitpage-mark-192.png");
}

function getMediaUrl(value?: string | null) {
  const safeUrl = resolveSafePublicMediaUrl(value);
  if (!safeUrl) return null;
  if (safeUrl.startsWith("/") || (!safeUrl.includes(":") && !safeUrl.startsWith("//"))) {
    return internalAssetPath(safeUrl) || null;
  }
  return safeUrl;
}
