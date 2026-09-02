import { useRef, useState, type CSSProperties, type ReactNode } from "react";

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
  moveProfileLayoutItem,
  normalizeProfileLayout,
  reorderProfileLayout,
  resizeProfileLayoutItem,
  type ProfileLayout,
  type ProfileLayoutItem,
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

export const PublicProfileSection = ({
  profile,
  fallbackName = "Name or brand",
  surfaceEffect = "solid",
  layoutEditing = false,
  onLayoutChange,
}: PublicProfileSectionProps) => {
  const { tr } = useAppI18n();
  const [draggingItem, setDraggingItem] = useState<ProfileLayoutItem | null>(null);
  const [dragOverItem, setDragOverItem] = useState<ProfileLayoutItem | null>(null);
  const resizeGestureRef = useRef<{ item: ProfileLayoutItem; span: 1 | 2; x: number } | null>(null);
  const suppressResizeClickRef = useRef(false);
  const hasBio = Boolean(profile.bio && profile.bio.trim() !== "");
  const displayName = profile.name?.trim() || fallbackName || "";
  const socialLinks = Object.fromEntries(SOCIALS.map(({ id }) => [id, resolveSafePublicHref(profile.socialLinks?.[id])])) as Record<typeof SOCIALS[number]["id"], string | null>;
  const hasSocialLinks = Object.values(socialLinks).some(Boolean);
  const profileDetails = profile.appearance?.profileDetails;
  const hasProfileDetails = Boolean(profileDetails?.primary || profileDetails?.secondary);
  const hasVisibleProfile = Boolean(displayName || hasBio || hasSocialLinks || hasProfileDetails || profile.showAvatar !== false || layoutEditing);
  const layout = normalizeProfileLayout(profile.appearance?.layout);

  if (!hasVisibleProfile) return null;

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

  const itemAtPoint = (x: number, y: number) => {
    const id = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-profile-layout-item]")?.dataset.profileLayoutItem;
    return layout.order.includes(id as ProfileLayoutItem) ? id as ProfileLayoutItem : null;
  };
  const finishDrag = (item: ProfileLayoutItem, before: ProfileLayoutItem | null) => {
    if (before && before !== item) onLayoutChange?.(reorderProfileLayout(layout, item, before));
    setDraggingItem(null);
    setDragOverItem(null);
  };

  return (
    <Card
      className={`profile-card glass-card p-8 text-center transition-smooth hover:glow-effect${layoutEditing ? " profile-card--layout-editing" : ""}`}
      data-profile-layout-editor={layoutEditing ? "true" : undefined}
      data-surface-effect={profile.appearance?.surfaceEffect && profile.appearance.surfaceEffect !== "inherit" ? profile.appearance.surfaceEffect : surfaceEffect}
      style={getProfileAppearanceStyle(profile.appearance)}
    >
      {profile.appearance?.layout || layoutEditing ? (
        <div className="profile-card__layout" style={{ "--profile-layout-gap": `${layout.gap}px` } as CSSProperties}>
          {layout.order.map((item, index) => {
            const content = contents[item];
            if (!content && !layoutEditing) return null;
            const span = layout.spans[item];
            return (
              <div
                className={`profile-card__layout-item profile-card__layout-item--${item}${draggingItem === item ? " is-dragging" : ""}${dragOverItem === item && draggingItem !== item ? " is-drag-over" : ""}`}
                data-profile-layout-item={item}
                data-profile-layout-span={span}
                draggable={layoutEditing}
                key={item}
                onDragEnd={() => finishDrag(item, null)}
                onDragEnter={() => setDragOverItem(item)}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", item);
                  setDraggingItem(item);
                }}
                onDrop={(event) => { event.preventDefault(); finishDrag(draggingItem || item, item); }}
                style={{ "--profile-layout-span": span } as CSSProperties}
              >
                {layoutEditing && (
                  <button
                    aria-label={`${tr("Move", "Sposta")} ${labels[item]}`}
                    className="profile-card__layout-grip"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (!["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.key)) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onLayoutChange?.(moveProfileLayoutItem(layout, item, event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1));
                    }}
                    onPointerCancel={() => finishDrag(item, null)}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraggingItem(item);
                      setDragOverItem(item);
                    }}
                    onPointerMove={(event) => {
                      if (draggingItem !== item) return;
                      setDragOverItem(itemAtPoint(event.clientX, event.clientY));
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      finishDrag(item, itemAtPoint(event.clientX, event.clientY));
                    }}
                    title={tr("Drag to move. Use arrow keys for precise ordering.", "Trascina per spostare. Usa le frecce per un ordine preciso.")}
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
                    aria-label={`${tr("Resize", "Ridimensiona")} ${labels[item]}: ${span === 2 ? tr("Full width", "Larghezza intera") : tr("Half width", "Mezza larghezza")}`}
                    className="profile-card__layout-resize"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (suppressResizeClickRef.current) return;
                      onLayoutChange?.(resizeProfileLayoutItem(layout, item, span === 1 ? 2 : 1));
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      suppressResizeClickRef.current = true;
                      window.setTimeout(() => { suppressResizeClickRef.current = false; }, 0);
                      onLayoutChange?.(resizeProfileLayoutItem(layout, item, span === 1 ? 2 : 1));
                    }}
                    onPointerCancel={() => {
                      resizeGestureRef.current = null;
                      suppressResizeClickRef.current = false;
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      resizeGestureRef.current = { item, span, x: event.clientX };
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const gesture = resizeGestureRef.current;
                      resizeGestureRef.current = null;
                      if (!gesture || gesture.item !== item) return;
                      suppressResizeClickRef.current = true;
                      window.setTimeout(() => { suppressResizeClickRef.current = false; }, 0);
                      const nextSpan = Math.abs(event.clientX - gesture.x) < 12 ? (gesture.span === 1 ? 2 : 1) : (event.clientX > gesture.x ? 2 : 1);
                      if (nextSpan !== gesture.span) onLayoutChange?.(resizeProfileLayoutItem(layout, item, nextSpan));
                    }}
                    title={tr("Drag sideways or press to change width", "Trascina lateralmente o premi per cambiare larghezza")}
                    type="button"
                  >
                    <span aria-hidden="true" />
                  </button>
                )}
                {layoutEditing && <span className="sr-only">{index + 1} / {layout.order.length}</span>}
              </div>
            );
          })}
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
