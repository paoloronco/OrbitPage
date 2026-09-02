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

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GripVertical } from "@/components/ui/material-icons";
import { BriefcaseBusiness, Linkedin, Github, Instagram, Facebook, MapPin, Twitter, Youtube } from "lucide-react";
import { TikTokIcon, DiscordIcon, TelegramIcon, WhatsAppIcon, MastodonIcon } from "./SocialIcons";
import profileAvatar from "@/assets/profile-avatar.jpg";
import { internalAssetPath } from "@/lib/base-path";
import { resolveSafePublicHref, resolveSafePublicMediaUrl } from "@/lib/browser-network-policy";
import { getProfileAppearanceStyle, getProfileAvatarStyle, type ProfileAppearance } from "@/lib/profile-appearance";
import {
  normalizeProfileLayout,
  updateProfileLayoutItem,
  type NormalizedProfileLayout,
  type ProfileLayout,
  type ProfileLayoutItem,
  type ProfileLayoutRect,
} from "@/lib/profile-layout";
import { useAppI18n } from "@/lib/i18n";
import type { CardSurfaceEffect } from "@/lib/theme";

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
  onLayoutChange?: (layout: ProfileLayout) => void;
}

type LayoutGesture = {
  item: ProfileLayoutItem;
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  startRect: ProfileLayoutRect;
  layout: NormalizedProfileLayout;
  bounds: DOMRect;
  scale: number;
};

type AlignmentGuides = { x?: number; y?: number };

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

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

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

function alignedRect(
  layout: NormalizedProfileLayout,
  item: ProfileLayoutItem,
  rect: ProfileLayoutRect,
  mode: LayoutGesture["mode"],
  thresholdX: number,
  thresholdY: number,
) {
  const others = Object.entries(layout.positions)
    .filter(([id]) => id !== item)
    .map(([, position]) => position);
  const xTargets = [0, 50, 100, ...others.flatMap((position) => [position.x, position.x + position.width / 2, position.x + position.width])];
  const yTargets = [0, layout.height, ...others.flatMap((position) => [position.y, position.y + position.height / 2, position.y + position.height])];
  const xSnap = closestSnap(
    mode === "move" ? [rect.x, rect.x + rect.width / 2, rect.x + rect.width] : [rect.x + rect.width],
    xTargets,
    thresholdX,
  );
  const ySnap = closestSnap(
    mode === "move" ? [rect.y, rect.y + rect.height / 2, rect.y + rect.height] : [rect.y + rect.height],
    yTargets,
    thresholdY,
  );

  const next = { ...rect };
  if (xSnap) {
    if (mode === "move") next.x += xSnap.shift;
    else next.width += xSnap.shift;
  }
  if (ySnap) {
    if (mode === "move") next.y += ySnap.shift;
    else next.height += ySnap.shift;
  }
  next.width = clamp(next.width, 12, 100 - next.x);
  next.height = clamp(next.height, 36, 600);
  next.x = clamp(next.x, 0, 100 - next.width);
  next.y = clamp(next.y, 0, 1_600);
  return { rect: next, guides: { x: xSnap?.guide, y: ySnap?.guide } as AlignmentGuides };
}

export const PublicProfileSection = ({
  profile,
  fallbackName = "Name or brand",
  surfaceEffect = "solid",
  layoutEditing = false,
  onLayoutChange,
}: PublicProfileSectionProps) => {
  const { tr } = useAppI18n();
  const rawLayout = profile.appearance?.layout;
  const savedLayout = useMemo(() => normalizeProfileLayout(rawLayout), [rawLayout]);
  const [workingLayout, setWorkingLayout] = useState(savedLayout);
  const [activeItem, setActiveItem] = useState<ProfileLayoutItem | null>(null);
  const [guides, setGuides] = useState<AlignmentGuides>({});
  const [measuredContentHeight, setMeasuredContentHeight] = useState(0);
  const layoutRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<LayoutGesture | null>(null);
  const latestLayoutRef = useRef(workingLayout);
  const hasBio = Boolean(profile.bio && profile.bio.trim() !== "");
  const displayName = profile.name?.trim() || fallbackName || "";
  const socialLinks = Object.fromEntries(SOCIALS.map(({ id }) => [id, resolveSafePublicHref(profile.socialLinks?.[id])])) as Record<typeof SOCIALS[number]["id"], string | null>;
  const hasSocialLinks = Object.values(socialLinks).some(Boolean);
  const profileDetails = profile.appearance?.profileDetails;
  const hasProfileDetails = Boolean(profileDetails?.primary || profileDetails?.secondary);
  const hasVisibleProfile = Boolean(displayName || hasBio || hasSocialLinks || hasProfileDetails || profile.showAvatar !== false || layoutEditing);
  const layout = layoutEditing ? workingLayout : savedLayout;

  useEffect(() => {
    if (!gestureRef.current) {
      latestLayoutRef.current = savedLayout;
      setWorkingLayout(savedLayout);
    }
  }, [savedLayout]);

  const avatar = profile.showAvatar !== false ? (
    <Avatar className="profile-card__avatar" style={getProfileAvatarStyle(profile.appearance)}>
      <AvatarImage className="object-cover object-center" src={getAvatarUrl(profile.avatar)} alt={profile.name || "Page avatar"} />
      <AvatarFallback delayMs={1_200} className="profile-card__avatar-fallback text-4xl font-bold">{profile.name?.charAt(0) ?? "U"}</AvatarFallback>
    </Avatar>
  ) : null;
  const name = displayName ? (
    <h1
      className="profile-card__title font-bold"
      style={{ "--profile-name-font-size": profile.nameFontSize || "2rem" } as CSSProperties}
    >
      {displayName}
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
      style={{ "--profile-bio-font-size": profile.bioFontSize || "1rem" } as CSSProperties}
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
    work: profileDetails?.primary ? <span className="profile-card__detail inline-flex items-center justify-center gap-1.5"><BriefcaseBusiness className="h-3.5 w-3.5" />{profileDetails.primary}</span> : null,
    location: profileDetails?.secondary ? <span className="profile-card__detail inline-flex items-center justify-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{profileDetails.secondary}</span> : null,
    socials,
    bio,
  };
  const baseCanvasHeight = layoutEditing
    ? layout.height
    : Math.max(160, ...(Object.keys(layout.positions) as ProfileLayoutItem[])
        .filter((item) => contents[item])
        .map((item) => layout.positions[item].y + layout.positions[item].height));
  const canvasHeight = Math.max(baseCanvasHeight, measuredContentHeight);

  useLayoutEffect(() => {
    const canvas = layoutRef.current;
    if (!canvas) return;
    const measure = () => {
      const items = Array.from(canvas.querySelectorAll<HTMLElement>("[data-profile-layout-item]"));
      const contentHeight = Math.max(0, ...items.map((item) => item.offsetTop + Math.max(item.offsetHeight, item.scrollHeight)));
      setMeasuredContentHeight(Math.ceil(contentHeight));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    canvas.querySelectorAll("[data-profile-layout-item]").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [displayName, hasSocialLinks, layout, layoutEditing, profile.bio, profile.showAvatar, profileDetails?.primary, profileDetails?.secondary]);

  if (!hasVisibleProfile) return null;

  const applyWorkingLayout = (next: NormalizedProfileLayout) => {
    latestLayoutRef.current = next;
    setWorkingLayout(next);
  };

  const startGesture = (
    event: ReactPointerEvent<HTMLElement>,
    item: ProfileLayoutItem,
    mode: LayoutGesture["mode"],
  ) => {
    if (!layoutEditing || event.button !== 0) return;
    const canvas = layoutRef.current;
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = canvas.getBoundingClientRect();
    const itemElement = event.currentTarget.closest<HTMLElement>("[data-profile-layout-item]");
    const startRect = { ...layout.positions[item] };
    if (mode === "resize" && itemElement) startRect.height = Math.max(startRect.height, itemElement.offsetHeight);
    gestureRef.current = {
      item,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect,
      layout,
      bounds,
      scale: Math.max(.01, bounds.width / canvas.offsetWidth),
    };
    latestLayoutRef.current = layout;
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
          width: gesture.startRect.width + deltaX,
          height: gesture.startRect.height + deltaY,
        };
    const snapped = alignedRect(
      gesture.layout,
      gesture.item,
      rect,
      gesture.mode,
      6 / gesture.bounds.width * 100,
      6 / gesture.scale,
    );
    setGuides(snapped.guides);
    applyWorkingLayout(updateProfileLayoutItem(gesture.layout, gesture.item, snapped.rect));
  };

  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    gestureRef.current = null;
    setActiveItem(null);
    setGuides({});
    onLayoutChange?.(latestLayoutRef.current);
  };

  const cancelGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setActiveItem(null);
    setGuides({});
    applyWorkingLayout(gesture.layout);
  };

  const commitKeyboardChange = (item: ProfileLayoutItem, rect: ProfileLayoutRect) => {
    const next = updateProfileLayoutItem(layout, item, rect);
    applyWorkingLayout(next);
    onLayoutChange?.(next);
  };

  const moveWithKeyboard = (event: ReactKeyboardEvent, item: ProfileLayoutItem) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = layout.positions[item];
    const step = event.shiftKey ? 4 : 1;
    commitKeyboardChange(item, {
      ...rect,
      x: rect.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
      y: rect.y + (event.key === "ArrowUp" ? -step * 4 : event.key === "ArrowDown" ? step * 4 : 0),
    });
  };

  const resizeWithKeyboard = (event: ReactKeyboardEvent, item: ProfileLayoutItem) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = layout.positions[item];
    const step = event.shiftKey ? 4 : 1;
    commitKeyboardChange(item, {
      ...rect,
      width: rect.width + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
      height: rect.height + (event.key === "ArrowUp" ? -step * 4 : event.key === "ArrowDown" ? step * 4 : 0),
    });
  };

  return (
    <Card
      className={`profile-card glass-card p-8 text-center transition-smooth hover:glow-effect${layoutEditing ? " profile-card--layout-editing" : ""}`}
      data-profile-layout-editor={layoutEditing ? "true" : undefined}
      data-surface-effect={profile.appearance?.surfaceEffect && profile.appearance.surfaceEffect !== "inherit" ? profile.appearance.surfaceEffect : surfaceEffect}
      style={getProfileAppearanceStyle(profile.appearance)}
    >
      {profile.appearance?.layout || layoutEditing ? (
        <div
          className="profile-card__layout profile-card__layout--free"
          ref={layoutRef}
          style={{ "--profile-layout-height": `${canvasHeight}px` } as CSSProperties}
        >
          {(Object.keys(layout.positions) as ProfileLayoutItem[]).map((item) => {
            const content = contents[item];
            if (!content && !layoutEditing) return null;
            const rect = layout.positions[item];
            const center = rect.x + rect.width / 2;
            const alignment = center < 42 ? "left" : center > 58 ? "right" : "center";
            return (
              <div
                className={`profile-card__layout-item profile-card__layout-item--${item}${activeItem === item ? " is-dragging" : ""}`}
                data-profile-layout-align={alignment}
                data-profile-layout-item={item}
                data-profile-layout-position={`${rect.x},${rect.y},${rect.width},${rect.height}`}
                key={item}
                onPointerCancel={cancelGesture}
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
                    title={tr("Drag freely. Use arrow keys for precise movement.", "Trascina liberamente. Usa le frecce per movimenti precisi.")}
                    type="button"
                  >
                    <GripVertical aria-hidden="true" size={17} />
                  </button>
                )}

                <div className="profile-card__layout-content">
                  {content || <span className="profile-card__layout-placeholder">{labels[item]}</span>}
                </div>

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
                    <span aria-hidden="true" />
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
              <div className="profile-card__details flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
                {profileDetails?.primary && <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="h-3.5 w-3.5" />{profileDetails.primary}</span>}
                {profileDetails?.secondary && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{profileDetails.secondary}</span>}
              </div>
            )}
            {socials && <div className="mb-4">{socials}</div>}
            {bio}
          </div>
        </>
      )}
    </Card>
  );
};

function getAvatarUrl(avatar?: string | null) {
  const safeUrl = resolveSafePublicMediaUrl(avatar);
  if (!safeUrl) return profileAvatar as unknown as string;
  if (safeUrl.startsWith("/") || (!safeUrl.includes(":") && !safeUrl.startsWith("//"))) {
    return internalAssetPath(safeUrl) || (profileAvatar as unknown as string);
  }
  return safeUrl;
}
