import { type ChangeEvent, type CSSProperties, type DragEvent, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, CalendarClock, Code2, Film, Image, Loader2, LockKeyhole, MapPin, Plus, RotateCcw, Share2, ShieldCheck, Tag, UserCircle2, X, Edit, Eye, EyeOff, ExternalLink, Upload, Trash2, GripVertical, MousePointerClick, UtensilsCrossed } from "lucide-react";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import { LinkEditMode } from "@/lib/permissions";
import { DEFAULT_SELF_HOSTED_VIDEO_MAX_BYTES, isAllowedRasterImageFile, RASTER_IMAGE_ACCEPT, validateVideoFile, VIDEO_ACCEPT } from "@/lib/media-validation";
import { optimizeImageForUpload, type ImageUploadVariant } from "@/lib/image-upload";
import { mapPreviewApi, uploadApi } from "@/lib/api-client";
import {
  type ContactBlockData,
  type EmbedBlockData,
  type EmbedConsentCategory,
  type EmbedProvider,
  type EventBlockData,
  type LinkBlockType,
  type MapBlockData,
  type SocialLinkPlatform,
  type SocialRowBlockData,
  type SocialRowIconStyle,
  type SocialRowItemData,
  type VideoBlockData,
  buildBlockContent,
  getCalloutData,
  getContactData,
  getDefaultEmbedConsentCategory,
  getEmbedData,
  getEmbedProviderDefaultHeight,
  getEmbedProviderLabel,
  getEmbedProviderPlaceholder,
  getEventData,
  getMapData,
  getSeparatorData,
  getServiceLinkData,
  getSocialRowDraftData,
  getVideoData,
  isSocialRowContent,
  resolveEmbedProvider,
  isPublicActionableBlock,
} from "@/lib/link-blocks";
import { CompactLinkIcon } from "./CompactLinkIcon";
import { compactLinkPlatformOptions, getCompactLinkBrandStyle, getCompactLinkInputKind } from "@/lib/compact-links";
import { isNativeMenuLink } from "@/lib/native-menu-link";
import { useAppI18n } from "@/lib/i18n";
import {
  extractMapCoordinates,
  getMapQuery,
  getMapResolutionSource,
  toMapCoordinates,
} from "@/lib/map-location";
import { brandServiceColors, isBrandServiceProvider } from "@/lib/service-brand";
import { ServiceBrandIcon } from "./ServiceBrandIcon";
import type { CardSurfaceEffect } from "@/lib/theme";

export interface LinkData {
  id: string;
  title: string;
  description: string;
  url: string;
  hideUrl?: boolean;
  icon?: string;
  iconType?: 'emoji' | 'image' | 'svg';
  backgroundColor?: string;
  textColor?: string;
  surfaceEffect?: CardSurfaceEffect | 'inherit';
  // Per-link typography (pixel strings, e.g. '16px')
  titleFontSize?: string;
  titleFontFamily?: string;
  descriptionFontSize?: string;
  descriptionFontFamily?: string;
  // Alignment for content inside the card: left | center | right
  alignment?: 'left' | 'center' | 'right';
  size?: 'small' | 'medium' | 'large';
  type?: LinkBlockType;
  isActive?: boolean; // Visibility toggle (undefined treated as true)
  content?: string; // For text-only cards
  clickCount?: number;
  ctaAction?: 'book' | 'contact' | 'download' | 'subscribe' | 'buy';
  ctaClicks?: number;
  status?: 'draft' | 'live' | 'expired';
  campaignName?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  timezone?: string;
  availability?: 'available' | 'unavailable';
  textItems?: Array<{
    text: string;
    url?: string;
    // Optional per-item styling
    textColor?: string;
    fontSize?: string;
    fontFamily?: string;
  }>; // For clickable list items
  coverImage?: string;    // Optional header/cover image URL or data URL
  coverImageAlt?: string; // Alt text for the cover image
}

interface LinkCardProps {
  link: LinkData;
  onUpdate: (link: LinkData) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  editMode?: LinkEditMode;
  publicPreviewStyle?: CSSProperties;
  defaultSurfaceEffect?: CardSurfaceEffect;
  inheritedBackgroundColor?: string;
  inheritedTextColor?: string;
  schedulingEnabled?: boolean;
  videoUploadsEnabled?: boolean;
  maxVideoUploadBytes?: number | null;
  managePlanHref?: string;
  health?: { status: 'healthy' | 'unreachable' | 'checking'; httpStatus: number | null; message: string };
  availablePages?: Array<{ title: string; url: string }>;
}

const compactSocialPresets: Array<{ platform: SocialLinkPlatform; label: string }> = [
  { platform: 'instagram', label: 'Instagram' },
  { platform: 'facebook', label: 'Facebook' },
  { platform: 'tiktok', label: 'TikTok' },
  { platform: 'whatsapp', label: 'WhatsApp' },
  { platform: 'linkedin', label: 'LinkedIn' },
  { platform: 'youtube', label: 'YouTube' },
  { platform: 'x', label: 'X / Twitter' },
  { platform: 'email', label: 'Email' },
];

const createCompactLinkItemId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `compact-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const LinkCard = ({
  link,
  onUpdate,
  onDelete,
  isDragging,
  onMoveUp,
  onMoveDown,
  editMode = 'full',
  publicPreviewStyle,
  defaultSurfaceEffect = 'solid',
  inheritedBackgroundColor = '#000000',
  inheritedTextColor = '#ffffff',
  schedulingEnabled = true,
  videoUploadsEnabled = true,
  maxVideoUploadBytes,
  managePlanHref = "/dashboard/billing",
  health,
  availablePages = [],
}: LinkCardProps) => {
  const { tr } = useAppI18n();
  const compactPlatformLabel = (platform: SocialLinkPlatform, fallback: string) => {
    if (platform === 'auto') return tr('Auto detect', 'Rilevamento automatico');
    if (platform === 'page') return tr('OrbitPage page', 'Pagina OrbitPage');
    if (platform === 'link') return tr('Generic link', 'Link generico');
    if (platform === 'website') return tr('Website', 'Sito web');
    return fallback;
  };
  const [isEditing, setIsEditing] = useState(false);
  const [editLink, setEditLink] = useState(link);
  const [uploadingImage, setUploadingImage] = useState<ImageUploadVariant | null>(null);
  const [imageUploadError, setImageUploadError] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploadError, setVideoUploadError] = useState("");
  const [resolvingMap, setResolvingMap] = useState(false);
  const [mapLookupError, setMapLookupError] = useState("");
  const compactLinkDragIndexRef = useRef<number | null>(null);

  const isFullEdit = editMode === 'full';
  const canEditStyle = editMode === 'full' || editMode === 'style';
  const canEditImages = editMode === 'full' || editMode === 'images';
  const canEdit = editMode !== 'view';
  const canDelete = editMode === 'full';
  const canReorder = editMode === 'full';

  const handleSave = async () => {
    if (uploadingImage || uploadingVideo || resolvingMap) return;
    let normalizedLink = isNativeMenuLink(editLink)
      ? { ...editLink, type: 'menu' as const, hideUrl: true }
      : editLink;

    if (normalizedLink.type === 'map') {
      const data = getMapData(normalizedLink.content);
      const source = getMapResolutionSource(data.placeName, data.address, data.mapUrl);
      const existingCoordinates = data.resolvedSource === source
        ? toMapCoordinates(data.latitude, data.longitude)
        : null;
      const directCoordinates = extractMapCoordinates(data.mapUrl)
        || extractMapCoordinates(data.address)
        || extractMapCoordinates(data.placeName);
      const query = getMapQuery(
        data.placeName,
        data.address,
        normalizedLink.title && normalizedLink.title !== 'Map' ? normalizedLink.title : '',
        data.mapUrl,
      );

      let coordinates = directCoordinates || existingCoordinates;
      if (!coordinates && (query || data.mapUrl)) {
        setResolvingMap(true);
        setMapLookupError("");
        try {
          const resolved = await mapPreviewApi.resolve(query, data.mapUrl);
          coordinates = toMapCoordinates(resolved.lat, resolved.lon);
          if (!coordinates) throw new Error("The map provider returned invalid coordinates.");
        } catch (error) {
          setMapLookupError(error instanceof Error ? error.message : "The location could not be resolved.");
          setResolvingMap(false);
          return;
        }
        setResolvingMap(false);
      }

      normalizedLink = {
        ...normalizedLink,
        url: '',
        hideUrl: true,
        content: buildBlockContent({
          ...data,
          latitude: coordinates ? String(coordinates.lat) : undefined,
          longitude: coordinates ? String(coordinates.lon) : undefined,
          resolvedSource: coordinates ? source : undefined,
        }),
      };
    }

    const sanitizedLink = isSocialRow
      ? {
          ...normalizedLink,
          type: 'social_row' as const,
          title: '',
          description: '',
          url: '',
          hideUrl: true,
          icon: undefined,
          iconType: undefined,
          coverImage: undefined,
          coverImageAlt: undefined,
        }
      : normalizedLink.type === 'separator'
      ? {
          ...normalizedLink,
          description: '',
          url: '',
          icon: undefined,
          iconType: undefined,
          coverImage: undefined,
          coverImageAlt: undefined,
        }
      : normalizedLink;
    onUpdate(sanitizedLink);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditLink(link);
    setImageUploadError("");
    setVideoUploadError("");
    setMapLookupError("");
    setIsEditing(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const uploadBlockImage = async (file: File, variant: "icon" | "cover") => {
    setUploadingImage(variant);
    setImageUploadError("");
    try {
      const optimized = await optimizeImageForUpload(file, variant);
      const uploaded = await uploadApi.uploadImage(optimized, `block-${link.id}-${variant}`);
      setEditLink((previous) => variant === "icon"
        ? { ...previous, icon: uploaded.filePath, iconType: "image" }
        : { ...previous, coverImage: uploaded.filePath });
    } catch (error) {
      setImageUploadError(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploadingImage(null);
    }
  };

  const handleIconUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isAllowedRasterImageFile(file)) {
        setImageUploadError("Unsupported image type. Use PNG, JPG, GIF, or WebP.");
        e.target.value = '';
        return;
      }
      await uploadBlockImage(file, "icon");
    }
    e.target.value = '';
  };

  const handleCoverImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isAllowedRasterImageFile(file)) {
        setImageUploadError("Unsupported image type. Use PNG, JPG, GIF, or WebP.");
        e.target.value = '';
        return;
      }
      await uploadBlockImage(file, "cover");
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleVideoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!videoUploadsEnabled) {
      setVideoUploadError('Video uploads are not available on this plan.');
      return;
    }
    try {
      validateVideoFile(file, maxVideoUploadBytes ?? DEFAULT_SELF_HOSTED_VIDEO_MAX_BYTES);
      setUploadingVideo(true);
      setVideoUploadProgress(0);
      setVideoUploadError('');
      const uploaded = await uploadApi.uploadVideo(file, `block-${link.id}-video`, setVideoUploadProgress);
      setEditLink((previous) => ({
        ...previous,
        content: buildBlockContent({ ...getVideoData(previous.content), mediaUrl: uploaded.filePath }),
      }));
    } catch (error) {
      setVideoUploadError(error instanceof Error ? error.message : 'Video upload failed.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const getSizeClasses = (size?: string) => {
    switch (size) {
      case 'small': return 'p-3';
      case 'large': return 'p-6';
      default: return 'p-4';
    }
  };

  const getCustomStyles = () => {
    const styles: CSSProperties = {};
    if (link.backgroundColor) {
      styles.backgroundColor = link.backgroundColor;
    }
    if (link.textColor) {
      styles.color = link.textColor;
    }
    if (link.titleFontFamily) {
      styles.fontFamily = link.titleFontFamily;
    }
    // text alignment applies to block-level content inside the card
    if (link.alignment) {
      styles.textAlign = link.alignment as 'left' | 'center' | 'right' | 'justify';
    }
    return styles;
  };

  const handleClick = () => {
    if (!isEditing && isPublicActionableBlock(link.type) && link.url) {
      window.open(link.url, '_blank');
    }
  };

  const isHeading = link.type === 'heading';
  const isSeparator = link.type === 'separator';
  const isImage = link.type === 'image';
  const isVideo = link.type === 'video';
  const isContact = link.type === 'contact';
  const isSocialRow = link.type === 'social_row' || isSocialRowContent(link.content);
  const isCallout = link.type === 'callout';
  const isMap = link.type === 'map';
  const isEvent = link.type === 'event';
  const isEmbed = link.type === 'embed';
  const isMenu = isNativeMenuLink(link);
  const isActionable = isPublicActionableBlock(link.type);
  const isClickable = isActionable && !!link.url;

  const contactData = getContactData(editLink.content);
  const socialData = getSocialRowDraftData(editLink.content);
  const calloutData = getCalloutData(editLink.content);
  const mapData = getMapData(editLink.content);
  const eventData = getEventData(editLink.content);
  const embedData = getEmbedData(editLink.content);
  const resolvedEmbedProvider = resolveEmbedProvider(embedData.provider, embedData.snippet);
  const serviceData = getServiceLinkData(editLink.content);
  const usesDirectEmbedUrl = resolvedEmbedProvider !== 'custom' && resolvedEmbedProvider !== 'newsletter';
  const separatorData = getSeparatorData(editLink.content);
  const videoData = getVideoData(editLink.content);

  const updateContactData = (field: keyof ContactBlockData, value: string) => {
    setEditLink(prev => ({ ...prev, content: buildBlockContent({ ...contactData, [field]: value }) }));
  };

  const updateCalloutData = (field: keyof ReturnType<typeof getCalloutData>, value: string) => {
    setEditLink(prev => ({ ...prev, content: buildBlockContent({ ...calloutData, [field]: value }) }));
  };

  const updateMapData = (field: keyof MapBlockData, value: string) => {
    setEditLink(prev => ({ ...prev, content: buildBlockContent({ ...mapData, [field]: value }) }));
  };

  const updateEventData = <K extends keyof EventBlockData>(field: K, value: EventBlockData[K]) => {
    setEditLink(prev => ({ ...prev, content: buildBlockContent({ ...eventData, [field]: value }) }));
  };

  const updateEmbedData = <K extends keyof EmbedBlockData,>(field: K, value: EmbedBlockData[K]) => {
    setEditLink(prev => ({ ...prev, content: buildBlockContent({ ...embedData, [field]: value }) }));
  };

  const updateEmbedProvider = (provider: EmbedProvider) => {
    const resolvedProvider = resolveEmbedProvider(provider, embedData.snippet);
    setEditLink(prev => ({
      ...prev,
      content: buildBlockContent({
        ...embedData,
        provider,
        consentCategory: getDefaultEmbedConsentCategory(resolvedProvider),
        height: getEmbedProviderDefaultHeight(resolvedProvider),
      }),
    }));
  };

  const updateSeparatorData = (field: keyof ReturnType<typeof getSeparatorData>, value: boolean) => {
    setEditLink(prev => ({ ...prev, content: buildBlockContent({ ...separatorData, [field]: value }) }));
  };

  const updateVideoData = <K extends keyof VideoBlockData>(field: K, value: VideoBlockData[K]) => {
    setEditLink((previous) => ({
      ...previous,
      content: buildBlockContent({ ...getVideoData(previous.content), [field]: value }),
    }));
  };

  const updateSocialData = <K extends keyof SocialRowBlockData>(field: K, value: SocialRowBlockData[K]) => {
    setEditLink((prev) => ({
      ...prev,
      content: buildBlockContent({ ...getSocialRowDraftData(prev.content), [field]: value }),
    }));
  };

  const addSocialItem = (item: SocialRowItemData = { label: "", url: "", platform: "auto", icon: "" }) => {
    setEditLink((prev) => {
      const current = getSocialRowDraftData(prev.content);
      if (current.items.length >= 16) return prev;
      return {
        ...prev,
        content: buildBlockContent({
          ...current,
          items: [...(current.items || []), { ...item, id: item.id || createCompactLinkItemId() }],
        }),
      };
    });
  };

  const updateSocialItem = (index: number, field: keyof SocialRowItemData, value: string) => {
    setEditLink((prev) => {
      const current = getSocialRowDraftData(prev.content);
      return {
        ...prev,
        content: buildBlockContent({
          ...current,
          items: current.items.map((item, itemIndex) => (
            itemIndex === index ? { ...item, [field]: value } : item
          )),
        }),
      };
    });
  };

  const removeSocialItem = (index: number) => {
    setEditLink((prev) => {
      const current = getSocialRowDraftData(prev.content);
      return {
        ...prev,
        content: buildBlockContent({
          ...current,
          items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }),
      };
    });
  };

  const moveSocialItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setEditLink((prev) => {
      const current = getSocialRowDraftData(prev.content);
      if (fromIndex >= current.items.length || toIndex >= current.items.length) return prev;
      const items = [...current.items];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return { ...prev, content: buildBlockContent({ ...current, items }) };
    });
  };

  const handleSocialDragStart = (event: DragEvent<HTMLElement>, index: number) => {
    event.stopPropagation();
    compactLinkDragIndexRef.current = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleSocialDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const sourceIndex = compactLinkDragIndexRef.current;
    if (sourceIndex !== null) moveSocialItem(sourceIndex, index);
    compactLinkDragIndexRef.current = null;
  };

  const titlePlaceholder = isHeading
    ? 'Heading title'
    : isVideo
      ? 'Video title'
    : isImage
      ? 'Image title'
      : isContact
        ? 'Contact card title'
        : isCallout
          ? 'Callout title'
          : isMap
            ? 'Map title'
            : isEvent
              ? 'Event title'
              : isEmbed
                ? 'Embed title'
                : isMenu
                  ? 'Menu title'
                  : 'Link title';
  const showUrlField = isActionable && !isContact && !isSocialRow && !isMenu && !isMap;

  const isVisible = link.isActive !== false;
  const isCta = link.type === 'cta';
  const renderAdminControls = () => canEdit ? (
    <div className="admin-card-controls flex gap-1 rounded-md border border-slate-200 bg-white/95 p-1 opacity-0 shadow-sm transition-smooth group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
      {canReorder && onMoveUp && (
        <Button
          onClick={onMoveUp}
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          title="Move up"
          aria-label="Move up"
        >
          ▲
        </Button>
      )}
      {canReorder && onMoveDown && (
        <Button
          onClick={onMoveDown}
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          title="Move down"
          aria-label="Move down"
        >
          ▼
        </Button>
      )}
      {isFullEdit && (
        <Button
          onClick={() => onUpdate({ ...link, isActive: !isVisible })}
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          title={isVisible ? 'Hide link' : 'Show link'}
          aria-label={isVisible ? 'Hide link' : 'Show link'}
        >
          {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
        </Button>
      )}
      <Button
        onClick={() => setIsEditing(true)}
        variant="ghost"
        size="icon"
        className="w-8 h-8"
        title="Edit block"
        aria-label="Edit block"
      >
        <Edit className="w-3 h-3" />
      </Button>
      {canDelete && (
        <Button
          onClick={() => onDelete(link.id)}
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-destructive hover:text-destructive"
          title="Delete block"
          aria-label="Delete block"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  ) : null;

  if (!isEditing) {
    return (
      <div
        className={`group relative transition-smooth ${
          isDragging ? 'opacity-50 rotate-2' : !isVisible ? 'opacity-40' : ''
        }`}
      >
        {canReorder && (
          <div className="admin-card-drag-handle absolute left-2 top-2 z-20 rounded-md bg-white/90 p-1 opacity-0 shadow-sm transition-smooth group-hover:opacity-100 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div>
          <div
            className="public-block-preview pointer-events-none"
            data-surface-effect={link.surfaceEffect && link.surfaceEffect !== 'inherit' ? link.surfaceEffect : defaultSurfaceEffect}
            style={publicPreviewStyle}
          >
            <PublicBlockRenderer link={link} />
          </div>
          <div className="admin-card-controls-wrap pointer-events-auto absolute right-2 top-2 z-20">
            {renderAdminControls()}
          </div>
          {health && <div className="mt-2 flex items-center gap-2 text-xs text-slate-500" title={health.message || undefined}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${health.status === 'healthy' ? 'bg-emerald-500' : health.status === 'unreachable' ? 'bg-red-500' : 'bg-slate-300'}`} aria-hidden="true" />
            <span>{health.status === 'healthy'
              ? tr('Link reachable', 'Link raggiungibile')
              : health.status === 'unreachable'
                ? `${tr('Link unreachable', 'Link non raggiungibile')}${health.httpStatus ? ` (${health.httpStatus})` : ''}`
                : tr('Checking link', 'Verifica link')}</span>
          </div>}
          {(link.status && link.status !== 'live') || link.campaignName || link.startDate || link.startTime || link.endDate || link.endTime || isCta ? (
            <div className="mt-2 text-xs text-slate-500">
              {(link.status && link.status !== 'live') || link.campaignName || link.startDate || link.startTime || link.endDate || link.endTime ? (
                <span>
                  {(link.status || 'live').toUpperCase()}
                  {link.campaignName ? ` · ${link.campaignName}` : ''}
                  {(link.startDate || link.startTime || link.endDate || link.endTime)
                    ? ` · ${link.startDate || 'any'} ${link.startTime || ''} -> ${link.endDate || 'any'} ${link.endTime || ''}`.trim()
                    : ''}
                </span>
              ) : null}
              {isCta ? (
                <span className="ml-2">CTA clicks: {link.ctaClicks ?? 0}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const renderReadOnlyBody = () => {
    if (isHeading) {
      return (
        <div className="min-w-0">
          <h3 className="font-bold text-base" style={{ ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}), ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}) }}>
            {link.title || 'Heading'}
          </h3>
          {link.description && (
            <p
              className="text-sm mt-1"
              style={{
                ...(link.textColor ? { color: link.textColor } : {}),
                ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}),
                ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}),
              }}
            >
              {link.description}
            </p>
          )}
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="min-w-0">
          {link.coverImage && (
            <div className="mb-2 rounded overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <img
                src={link.coverImage}
                alt={link.coverImageAlt || link.title || 'Image block'}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h3 className="font-semibold truncate" style={{ ...(link.textColor ? { color: link.textColor } : {}), ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}), ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}) }}>
            {link.title || 'Image'}
          </h3>
          {link.description && (
            <p
              className="text-sm line-clamp-2"
              style={{ ...(link.textColor ? { color: link.textColor } : {}), ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}), ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}) }}
            >
              {link.description}
            </p>
          )}
          {link.url && (
            <p className="text-xs mt-1 truncate underline font-medium" style={link.textColor ? { color: link.textColor } : undefined}>
              {link.url}
            </p>
          )}
        </div>
      );
    }

    if (isContact) {
      const contactRows = [
        { label: 'Phone', value: contactData.phone },
        { label: 'Email', value: contactData.email },
        { label: 'Website', value: contactData.website },
        { label: 'Address', value: contactData.address },
        { label: 'WhatsApp', value: contactData.whatsapp },
        { label: 'Telegram', value: contactData.telegram },
      ].filter((row) => row.value);
      return (
        <div className="min-w-0">
          <h3 className="font-semibold" style={{ ...(link.textColor ? { color: link.textColor } : {}) }}>
            {contactData.name || link.title || 'Contact'}
          </h3>
          {(contactData.role || contactData.title) && (
            <p className="text-sm text-muted-foreground mt-1">
              {[contactData.role, contactData.title].filter(Boolean).join(' · ')}
            </p>
          )}
          {contactRows.length > 0 && (
            <div className="mt-2 space-y-1 text-sm">
              {contactRows.map((row) => (
                <div key={row.label} className="flex gap-2">
                  <span className="w-20 text-muted-foreground">{row.label}</span>
                  <span>{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (isSocialRow) {
      return (
        <div className="admin-compact-link-summary min-w-0">
          <div className="admin-compact-link-summary-icons" aria-label={tr("Quick link preview", "Anteprima link rapidi")}>
            {socialData.items.slice(0, 8).map((item, index) => (
              <span
                key={`${item.label}-${item.url}-${index}`}
                className="admin-compact-link-summary-icon"
                style={socialData.iconStyle === 'brand' ? getCompactLinkBrandStyle(item.platform || 'auto', item.url) : undefined}
                title={item.label || compactPlatformLabel(item.platform || 'auto', 'Link')}
              >
                <CompactLinkIcon platform={item.platform} url={item.url} customIcon={item.icon} />
              </span>
            ))}
            {socialData.items.length === 0 && <span className="admin-compact-link-summary-empty">{tr("No icons yet", "Nessuna icona")}</span>}
          </div>
          <span>{socialData.items.length} {tr(socialData.items.length === 1 ? "quick link" : "quick links", socialData.items.length === 1 ? "link rapido" : "link rapidi")}</span>
        </div>
      );
    }

    if (isCallout) {
      return (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {calloutData.badge ? (
              <span className="inline-flex rounded-full bg-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                {calloutData.badge}
              </span>
            ) : null}
            <h3 className="font-semibold truncate">{link.title || 'Callout'}</h3>
          </div>
          {link.description && <p className="text-sm mt-1 text-muted-foreground">{link.description}</p>}
          {link.url && (
            <p className="text-xs mt-1 truncate underline font-medium">
              {calloutData.buttonLabel || 'Open'}
            </p>
          )}
        </div>
      );
    }

    if (isMap) {
      return (
        <div className="min-w-0">
          <h3 className="font-semibold" style={{ ...(link.textColor ? { color: link.textColor } : {}) }}>
            {mapData.placeName || link.title || 'Map'}
          </h3>
          {(mapData.address || link.description) && (
            <p className="text-sm text-muted-foreground mt-1">
              {mapData.address || link.description}
            </p>
          )}
          {mapData.mapUrl && (
            <p className="text-xs mt-1 truncate underline font-medium" style={link.textColor ? { color: link.textColor } : undefined}>
              {mapData.mapUrl}
            </p>
          )}
        </div>
      );
    }

    if (isEvent) {
      return (
        <div className="min-w-0">
          <h3 className="font-semibold" style={{ ...(link.textColor ? { color: link.textColor } : {}) }}>
            {link.title || 'Event'}
          </h3>
          {link.description && <p className="text-sm text-muted-foreground mt-1">{link.description}</p>}
          <p className="text-sm mt-1">
            {[
              eventData.date ? `Date: ${eventData.date}` : null,
              eventData.time ? `· ${eventData.time}` : null,
              eventData.location ? `· ${eventData.location}` : null,
            ].filter(Boolean).join(' ')}
          </p>
          {eventData.notes && <p className="text-sm text-muted-foreground mt-1">{eventData.notes}</p>}
        </div>
      );
    }

    return (
      <div className="flex-1 min-w-0">
        {link.coverImage && (
          <div className="mb-2 rounded overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <img
              src={link.coverImage}
              alt={link.coverImageAlt || ''}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        )}
        <div className="flex items-center gap-2 mb-1">
          {isCta && (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              <MousePointerClick className="h-3 w-3" />
              CTA
            </span>
          )}
          {!link.icon && serviceData.service && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-black/10" style={{ color: brandServiceColors[serviceData.service] }}>
              <ServiceBrandIcon provider={serviceData.service} className="h-4 w-4" />
            </span>
          )}
          {link.icon && (
            <div className="flex-shrink-0">
              {link.iconType === 'image' || link.iconType === 'svg' ? (
                <img src={link.icon} alt="" className="w-5 h-5 object-cover rounded" />
              ) : (
                <span className="text-lg">{link.icon}</span>
              )}
            </div>
          )}
          <h3 className="font-semibold truncate" style={{ ...(link.textColor ? { color: link.textColor } : {}), ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}), ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}) }}>
            {link.title || "Untitled Link"}
          </h3>
          <ExternalLink className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-smooth" />
        </div>
        {link.description && (
          <p
            className="text-sm line-clamp-2"
            style={{ ...(link.textColor ? { color: link.textColor } : {}), ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}), ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}) }}
          >
            {link.description}
          </p>
        )}
        {isActionable && link.url && !link.hideUrl && (
          <p
            className="text-xs mt-1 truncate underline font-medium"
            style={link.textColor ? { color: link.textColor } : undefined}
          >
            {link.url}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card
      className={`glass-card ${getSizeClasses(link.size)} transition-smooth hover:glow-effect group cursor-pointer relative ${
        isClickable ? 'cursor-pointer' : 'cursor-default'
      } ${
        isDragging ? 'opacity-50 rotate-2' : !isVisible ? 'opacity-40' : ''
      } ${isEditing ? 'admin-edit' : ''}`}
      onClick={handleClick}
      style={getCustomStyles()}
    >
      {canReorder && (
        <div className="admin-card-drag-handle absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-smooth cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      
      <div className={canReorder ? "admin-card-edit-body ml-6" : "admin-card-edit-body"}>
        {isEditing ? (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
            {!isSocialRow && (isFullEdit || canEditStyle) && (
            <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Content hierarchy</p>
                <p className="text-sm font-semibold text-slate-900">Title &amp; typography</p>
              </div>
              <div className="space-y-3">
              {isFullEdit && (
                <Input
                  value={editLink.title}
                  onChange={(e) => setEditLink(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={titlePlaceholder}
                  className="glass-card border-primary/20 bg-white text-black dark:bg-gray-800 dark:text-white"
                />
              )}
              {canEditStyle && (
              <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Title Font Size (px)</Label>
                <Input
                  type="number"
                  value={parseInt(editLink.titleFontSize || '16', 10)}
                  onChange={(e) => setEditLink(prev => ({ ...prev, titleFontSize: `${e.target.value}px` }))}
                  className="h-8 w-full"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description Font Size (px)</Label>
                <Input
                  type="number"
                  value={parseInt(editLink.descriptionFontSize || '14', 10)}
                  onChange={(e) => setEditLink(prev => ({ ...prev, descriptionFontSize: `${e.target.value}px` }))}
                  className="h-8 w-full"
                />
              </div>
              </div>
              )}
              {canEditStyle && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Title Font</Label>
                <Select
                  value={editLink.titleFontFamily || 'Inter, system-ui, sans-serif'}
                  onValueChange={(value: string) => setEditLink(prev => ({ ...prev, titleFontFamily: value }))}
                >
                  <SelectTrigger className="h-8 bg-white text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={"Inter, system-ui, sans-serif"}>Inter</SelectItem>
                    <SelectItem value={"Arial, Helvetica, sans-serif"}>Arial</SelectItem>
                    <SelectItem value={"Helvetica, Arial, sans-serif"}>Helvetica</SelectItem>
                    <SelectItem value={"Georgia, serif"}>Georgia</SelectItem>
                    <SelectItem value={"'Times New Roman', Times, serif"}>Times New Roman</SelectItem>
                    <SelectItem value={"'Courier New', Courier, monospace"}>Courier New</SelectItem>
                    <SelectItem value={"Verdana, Geneva, sans-serif"}>Verdana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description Font</Label>
                <Select
                  value={editLink.descriptionFontFamily || 'Inter, system-ui, sans-serif'}
                  onValueChange={(value: string) => setEditLink(prev => ({ ...prev, descriptionFontFamily: value }))}
                >
                  <SelectTrigger className="h-8 bg-white text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={"Inter, system-ui, sans-serif"}>Inter</SelectItem>
                    <SelectItem value={"Arial, Helvetica, sans-serif"}>Arial</SelectItem>
                    <SelectItem value={"Helvetica, Arial, sans-serif"}>Helvetica</SelectItem>
                    <SelectItem value={"Georgia, serif"}>Georgia</SelectItem>
                    <SelectItem value={"'Times New Roman', Times, serif"}>Times New Roman</SelectItem>
                    <SelectItem value={"'Courier New', Courier, monospace"}>Courier New</SelectItem>
                    <SelectItem value={"Verdana, Geneva, sans-serif"}>Verdana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alignment</Label>
                <Select
                  value={editLink.alignment || 'left'}
                  onValueChange={(value: 'left' | 'center' | 'right') => setEditLink(prev => ({ ...prev, alignment: value }))}
                >
                  <SelectTrigger className="h-8 bg-white text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              </div>
              )}
              </div>
            </section>
            )}
            {isFullEdit && (
              <>
                {!isSocialRow && !isMap && (!isSeparator || showUrlField) && (
                  <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                    <div className="mb-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Destination</p>
                      <p className="text-sm font-semibold text-slate-900">Description &amp; link</p>
                    </div>
                    <div className="space-y-3">
                      {!isSeparator && (
                        <Textarea
                          value={editLink.description}
                          onChange={(e) => setEditLink(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Block description"
                          className="glass-card border-primary/20 bg-white text-black dark:bg-gray-800 dark:text-white resize-none"
                          rows={2}
                        />
                      )}
                      {isMenu && (
                        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-blue-950">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                            <UtensilsCrossed className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">Native menu</p>
                            <p className="truncate text-xs text-blue-700">{editLink.url}</p>
                          </div>
                        </div>
                      )}
                      {showUrlField && (
                        <>
                          <Input
                            value={editLink.url}
                            onChange={(e) => setEditLink(prev => ({ ...prev, url: e.target.value }))}
                            placeholder={serviceData.service === 'whatsapp'
                              ? 'https://wa.me/391234567890'
                              : serviceData.service === 'github'
                                ? 'https://github.com/username'
                                : 'https://example.com'}
                            aria-label={serviceData.service ? `${serviceData.service} URL` : 'Destination URL'}
                            className="glass-card border-primary/20 bg-white text-black dark:bg-gray-800 dark:text-white"
                          />
                          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <div>
                              <Label htmlFor={`show-url-${link.id}`} className="text-sm font-medium text-slate-900">Show URL on card</Label>
                              <p className="mt-0.5 text-xs text-slate-500">The entire card stays clickable when hidden.</p>
                            </div>
                            <Switch
                              id={`show-url-${link.id}`}
                              checked={editLink.hideUrl !== true}
                              onCheckedChange={(checked) => setEditLink(prev => ({ ...prev, hideUrl: !checked }))}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </section>
                )}
                {isContact && (
                  <div className="space-y-2 rounded border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <UserCircle2 className="h-4 w-4" />
                      Contact fields
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={contactData.name || ''}
                        onChange={(e) => updateContactData('name', e.target.value)}
                        placeholder="Name"
                      />
                      <Input
                        value={contactData.title || ''}
                        onChange={(e) => updateContactData('title', e.target.value)}
                        placeholder="Title"
                      />
                    </div>
                    <Input
                      value={contactData.role || ''}
                      onChange={(e) => updateContactData('role', e.target.value)}
                      placeholder="Role"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={contactData.phone || ''}
                        onChange={(e) => updateContactData('phone', e.target.value)}
                        placeholder="Phone"
                      />
                      <Input
                        value={contactData.whatsapp || ''}
                        onChange={(e) => updateContactData('whatsapp', e.target.value)}
                        placeholder="WhatsApp (number)"
                      />
                    </div>
                    <Input
                      value={contactData.email || ''}
                      onChange={(e) => updateContactData('email', e.target.value)}
                      placeholder="Email"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={contactData.website || ''}
                        onChange={(e) => updateContactData('website', e.target.value)}
                        placeholder="Website"
                      />
                      <Input
                        value={contactData.telegram || ''}
                        onChange={(e) => updateContactData('telegram', e.target.value)}
                        placeholder="Telegram (@username)"
                      />
                    </div>
                    <Input
                      value={contactData.address || ''}
                      onChange={(e) => updateContactData('address', e.target.value)}
                      placeholder="Address"
                    />
                    <Input
                      value={contactData.note || ''}
                      onChange={(e) => updateContactData('note', e.target.value)}
                      placeholder="Note"
                    />
                  </div>
                )}
                {isSeparator && (
                  <div className="space-y-2 rounded border border-white/5 bg-white/5 p-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Separator background</Label>
                      <Select
                        value={separatorData.boxed === true ? 'full' : 'transparent'}
                        onValueChange={(value: 'transparent' | 'full') => updateSeparatorData('boxed', value === 'full')}
                      >
                        <SelectTrigger className="h-8 bg-white text-black">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transparent">Transparent line</SelectItem>
                          <SelectItem value="full">Full background</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Transparent keeps a classic separator. Full background turns it into a boxed section label.
                      </p>
                    </div>
                  </div>
                )}
                {isSocialRow && (
                  <div className="admin-compact-link-editor">
                    <div className="admin-compact-link-editor-heading">
                      <span className="admin-compact-link-editor-mark"><Share2 className="h-4 w-4" /></span>
                      <span>
                        <strong>{tr("Quick link dock", "Dock link rapidi")}</strong>
                        <small>{tr("Square icons in one transparent row below the profile.", "Icone quadrate in una riga trasparente sotto al profilo.")}</small>
                      </span>
                      <label className="admin-compact-link-label-toggle">
                        <span>{tr("Show text", "Mostra testo")}</span>
                        <Switch checked={socialData.showLabels === true} onCheckedChange={(checked) => updateSocialData('showLabels', checked)} />
                      </label>
                    </div>

                    <div className="admin-compact-link-add-panel">
                      <div className="admin-compact-link-add-heading">
                        <span>
                          <strong>{tr("Add an icon", "Aggiungi un'icona")}</strong>
                          <small>{tr("Choose a social app or add any custom URL.", "Scegli un social oppure aggiungi qualsiasi URL.")}</small>
                        </span>
                        <Button type="button" variant="outline" size="sm" onClick={() => addSocialItem()} disabled={socialData.items.length >= 16}>
                          <Plus className="mr-1 h-3.5 w-3.5" />{tr("Custom URL", "URL personalizzato")}
                        </Button>
                      </div>
                      <div className="admin-compact-link-presets" aria-label={tr("Social presets", "Preset social")}>
                        {compactSocialPresets.map((preset) => (
                          <button
                            key={preset.platform}
                            type="button"
                            onClick={() => addSocialItem({ label: preset.label, url: '', platform: preset.platform, icon: '' })}
                            disabled={socialData.items.length >= 16}
                            title={`${tr("Add", "Aggiungi")} ${preset.label}`}
                            aria-label={`${tr("Add", "Aggiungi")} ${preset.label}`}
                          >
                            <span style={getCompactLinkBrandStyle(preset.platform, '')}>
                              <CompactLinkIcon platform={preset.platform} url="" />
                            </span>
                            <small>{preset.label}</small>
                          </button>
                        ))}
                      </div>
                    </div>

                    {availablePages.length > 0 && (
                      <div className="admin-compact-link-pages">
                        <Label>{tr("Your OrbitPage pages", "Le tue pagine OrbitPage")}</Label>
                        <div>
                          {availablePages.map((page) => (
                            <Button key={page.url} type="button" variant="outline" size="sm" disabled={socialData.items.length >= 16} onClick={() => addSocialItem({ label: page.title, url: page.url, platform: 'page', icon: '' })}>
                              <Plus className="mr-1 h-3 w-3" />{page.title}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {socialData.items.length > 0 ? (
                      <div className="admin-compact-link-board">
                        {socialData.items.map((item, index) => (
                          <div
                            key={item.id || `${link.id}-compact-${index}`}
                            className="admin-compact-link-item"
                            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                            onDrop={(event) => handleSocialDrop(event, index)}
                            onDragEnd={() => { compactLinkDragIndexRef.current = null; }}
                          >
                            <div className="admin-compact-link-item-heading">
                              <button type="button" className="admin-compact-link-drag" draggable onDragStart={(event) => handleSocialDragStart(event, index)} title={tr("Drag to reorder", "Trascina per riordinare")} aria-label={tr("Drag to reorder", "Trascina per riordinare")}>
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <span className="admin-compact-link-icon-preview" style={socialData.iconStyle === 'brand' ? getCompactLinkBrandStyle(item.platform || 'auto', item.url) : undefined}>
                                <CompactLinkIcon platform={item.platform} url={item.url} customIcon={item.icon} />
                              </span>
                              <span className="admin-compact-link-item-copy">
                                <strong>{item.label || compactPlatformLabel(item.platform || 'auto', tr('Custom link', 'Link personalizzato'))}</strong>
                                <small>{tr("Drag this tile to change its position.", "Trascina il riquadro per cambiarne la posizione.")}</small>
                              </span>
                              <span className="admin-compact-link-order-actions">
                                <Button type="button" variant="ghost" size="icon" onClick={() => moveSocialItem(index, index - 1)} disabled={index === 0} title={tr("Move left", "Sposta a sinistra")} aria-label={tr("Move left", "Sposta a sinistra")}><ArrowLeft className="h-3.5 w-3.5" /></Button>
                                <Button type="button" variant="ghost" size="icon" onClick={() => moveSocialItem(index, index + 1)} disabled={index === socialData.items.length - 1} title={tr("Move right", "Sposta a destra")} aria-label={tr("Move right", "Sposta a destra")}><ArrowRight className="h-3.5 w-3.5" /></Button>
                                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeSocialItem(index)} title={tr("Remove link", "Rimuovi link")} aria-label={tr("Remove link", "Rimuovi link")}><X className="h-3.5 w-3.5" /></Button>
                              </span>
                            </div>
                            <div className="admin-compact-link-item-fields">
                              <div>
                                <Label htmlFor={`compact-link-url-${link.id}-${index}`}>
                                  {getCompactLinkInputKind(item.platform || 'auto') === 'username'
                                    ? tr("Username", "Nome utente")
                                    : getCompactLinkInputKind(item.platform || 'auto') === 'phone'
                                      ? tr("Phone number", "Numero di telefono")
                                      : getCompactLinkInputKind(item.platform || 'auto') === 'email'
                                        ? tr("Email address", "Indirizzo email")
                                        : tr("Destination URL", "URL di destinazione")}
                                </Label>
                                <Input
                                  id={`compact-link-url-${link.id}-${index}`}
                                  value={item.url}
                                  onChange={(e) => updateSocialItem(index, 'url', e.target.value)}
                                  inputMode={getCompactLinkInputKind(item.platform || 'auto') === 'phone'
                                    ? 'tel'
                                    : getCompactLinkInputKind(item.platform || 'auto') === 'email'
                                      ? 'email'
                                      : getCompactLinkInputKind(item.platform || 'auto') === 'url'
                                        ? 'url'
                                        : 'text'}
                                  autoCapitalize="none"
                                  autoCorrect="off"
                                  placeholder={getCompactLinkInputKind(item.platform || 'auto') === 'username'
                                    ? '@username'
                                    : getCompactLinkInputKind(item.platform || 'auto') === 'phone'
                                      ? '+39 123 456 7890'
                                      : getCompactLinkInputKind(item.platform || 'auto') === 'email'
                                        ? 'name@example.com'
                                        : 'https://example.com'}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`compact-link-platform-${link.id}-${index}`}>{tr("Icon", "Icona")}</Label>
                                <Select value={item.platform || 'auto'} onValueChange={(value: SocialLinkPlatform) => updateSocialItem(index, 'platform', value)}>
                                  <SelectTrigger id={`compact-link-platform-${link.id}-${index}`} className="bg-white text-black"><SelectValue /></SelectTrigger>
                                  <SelectContent>{compactLinkPlatformOptions.map((option) => <SelectItem key={option.value} value={option.value}>{compactPlatformLabel(option.value, option.label)}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`compact-link-label-${link.id}-${index}`}>{tr("Optional text", "Testo facoltativo")}</Label>
                                <Input
                                  id={`compact-link-label-${link.id}-${index}`}
                                  value={item.label}
                                  onChange={(e) => updateSocialItem(index, 'label', e.target.value)}
                                  placeholder={tr("Used for accessibility and optional labels", "Usato per accessibilità ed etichette opzionali")}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`compact-link-symbol-${link.id}-${index}`}>{tr("Custom symbol", "Simbolo personalizzato")}</Label>
                                <Input id={`compact-link-symbol-${link.id}-${index}`} maxLength={4} value={item.icon || ''} onChange={(e) => updateSocialItem(index, 'icon', e.target.value)} placeholder={tr("Optional emoji", "Emoji opzionale")} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="admin-compact-link-empty">
                        <Share2 className="h-5 w-5" />
                        <span><strong>{tr("Start with one icon", "Inizia con un'icona")}</strong><small>{tr("Pick a social app above or add a custom URL.", "Scegli un social qui sopra oppure aggiungi un URL personalizzato.")}</small></span>
                      </div>
                    )}

                    <div className="admin-compact-link-footer">
                      <span>{socialData.items.length}/16</span>
                      <label>
                        <span>{tr("Icon appearance", "Aspetto icone")}</span>
                        <Select value={socialData.iconStyle || 'brand'} onValueChange={(value: SocialRowIconStyle) => updateSocialData('iconStyle', value)}>
                          <SelectTrigger className="bg-white text-black"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="brand">{tr("Official brand colors", "Colori ufficiali")}</SelectItem>
                            <SelectItem value="theme">{tr("Page theme", "Tema pagina")}</SelectItem>
                            <SelectItem value="outline">{tr("Outline", "Contorno")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                  </div>
                )}
                {isCallout && (
                  <div className="space-y-2 rounded border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Tag className="h-4 w-4" />
                      Callout settings
                    </div>
                    <Input
                      value={calloutData.badge || ''}
                      onChange={(e) => updateCalloutData('badge', e.target.value)}
                      placeholder="Badge (optional)"
                    />
                    <Input
                      value={calloutData.buttonLabel || ''}
                      onChange={(e) => updateCalloutData('buttonLabel', e.target.value)}
                      placeholder="Button label"
                    />
                  </div>
                )}
                {isMap && (
                  <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <MapPin className="h-4 w-4" />
                        {tr("Map destination", "Destinazione mappa")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {tr("Add the location visitors should open. No separate card URL is needed.", "Aggiungi la posizione che i visitatori devono aprire. Non serve un URL separato per la card.")}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`map-place-${link.id}`}>{tr("Place name", "Nome del luogo")}</Label>
                      <Input
                        id={`map-place-${link.id}`}
                        value={mapData.placeName || ''}
                        onChange={(e) => updateMapData('placeName', e.target.value)}
                        placeholder={tr("Place name", "Nome del luogo")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`map-address-${link.id}`}>{tr("Address", "Indirizzo")}</Label>
                      <Input
                        id={`map-address-${link.id}`}
                        value={mapData.address || ''}
                        onChange={(e) => updateMapData('address', e.target.value)}
                        placeholder={tr("Street, city, country", "Via, citta, paese")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`map-url-${link.id}`}>{tr("Maps URL", "URL della mappa")}</Label>
                      <Input
                        id={`map-url-${link.id}`}
                        value={mapData.mapUrl || ''}
                        onChange={(e) => updateMapData('mapUrl', e.target.value)}
                        placeholder="https://maps.google.com/..."
                        inputMode="url"
                      />
                      <p className="text-xs text-slate-500">{tr("Google Maps and OpenStreetMap links are supported.", "Sono supportati i link di Google Maps e OpenStreetMap.")}</p>
                    </div>
                    {mapLookupError ? (
                      <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                        {tr("The preview could not locate this URL. Add the full street address or use a complete Maps link, then save again.", "La preview non riesce a localizzare questo URL. Aggiungi l'indirizzo completo o usa un link Maps completo, poi salva di nuovo.")}
                      </p>
                    ) : null}
                  </section>
                )}
                {isEvent && (
                  <div className="space-y-2 rounded border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CalendarClock className="h-4 w-4" />
                      Event settings
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={eventData.date || ''}
                        onChange={(e) => updateEventData('date', e.target.value)}
                        placeholder="Date (YYYY-MM-DD)"
                      />
                      <Input
                        type="time"
                        value={eventData.time || ''}
                        onChange={(e) => updateEventData('time', e.target.value)}
                        placeholder="Start time"
                      />
                      <Input
                        type="date"
                        value={eventData.endDate || ''}
                        onChange={(e) => updateEventData('endDate', e.target.value)}
                        placeholder="End date"
                      />
                      <Input
                        type="time"
                        value={eventData.endTime || ''}
                        onChange={(e) => updateEventData('endTime', e.target.value)}
                        placeholder="End time"
                      />
                    </div>
                    <Input
                      value={eventData.location || ''}
                      onChange={(e) => updateEventData('location', e.target.value)}
                      placeholder="Location"
                    />
                    <Input
                      value={eventData.ticketLabel || ''}
                      onChange={(e) => updateEventData('ticketLabel', e.target.value)}
                      placeholder="Button label"
                    />
                    <Input
                      value={eventData.notes || ''}
                      onChange={(e) => updateEventData('notes', e.target.value)}
                      placeholder="Notes"
                    />
                    <div className="grid gap-2 sm:grid-cols-[1fr,auto] sm:items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">{tr('Event timezone', 'Fuso orario evento')}</Label>
                        <Input
                          value={eventData.timezone || ''}
                          onChange={(e) => updateEventData('timezone', e.target.value)}
                          onFocus={() => {
                            if (!eventData.timezone) updateEventData('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
                          }}
                          placeholder="Europe/Rome"
                        />
                      </div>
                      <div className="flex min-h-9 items-center justify-between gap-4 rounded-md border bg-background px-3">
                        <Label htmlFor={`event-countdown-${link.id}`} className="text-xs">Countdown</Label>
                        <Switch
                          id={`event-countdown-${link.id}`}
                          checked={eventData.showCountdown !== false}
                          onCheckedChange={(checked) => updateEventData('showCountdown', checked)}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {isEmbed && (
                  <div className="space-y-3 rounded border border-white/5 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {isBrandServiceProvider(resolvedEmbedProvider)
                        ? <ServiceBrandIcon provider={resolvedEmbedProvider} className="h-4 w-4" />
                        : <Code2 className="h-4 w-4" />}
                      {getEmbedProviderLabel(resolvedEmbedProvider)} embed settings
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Provider</Label>
                        <Select value={embedData.provider || 'auto'} onValueChange={(value: EmbedProvider) => updateEmbedProvider(value)}>
                          <SelectTrigger className="h-9 bg-white text-black"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto detect</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="spotify">Spotify</SelectItem>
                            <SelectItem value="deezer">Deezer</SelectItem>
                            <SelectItem value="soundcloud">SoundCloud</SelectItem>
                            <SelectItem value="vimeo">Vimeo</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                            <SelectItem value="giphy">Giphy</SelectItem>
                            <SelectItem value="google_calendar">Google Calendar</SelectItem>
                            <SelectItem value="calendly">Calendly</SelectItem>
                            <SelectItem value="typeform">Typeform</SelectItem>
                            <SelectItem value="google_maps">Google Maps</SelectItem>
                            <SelectItem value="newsletter">Newsletter</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Consent category</Label>
                        <Select value={embedData.consentCategory || 'marketing'} onValueChange={(value: EmbedConsentCategory) => updateEmbedData('consentCategory', value)}>
                          <SelectTrigger className="h-9 bg-white text-black"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="necessary">Necessary · load immediately</SelectItem>
                            <SelectItem value="preferences">Preferences</SelectItem>
                            <SelectItem value="analytics">Analytics</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Embed height</Label>
                      <Input
                        type="number"
                        min={180}
                        max={900}
                        value={embedData.height || 360}
                        onChange={(event) => updateEmbedData('height', Number(event.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-xs">{usesDirectEmbedUrl ? `${getEmbedProviderLabel(resolvedEmbedProvider)} URL` : 'Snippet or HTTPS embed URL'}</Label>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {embedData.provider === 'auto' ? `Detected: ${getEmbedProviderLabel(resolvedEmbedProvider)}` : 'Official player'}
                        </span>
                      </div>
                      {usesDirectEmbedUrl ? (
                        <Input
                          value={embedData.snippet || ''}
                          onChange={(event) => updateEmbedData('snippet', event.target.value)}
                          placeholder={getEmbedProviderPlaceholder(resolvedEmbedProvider)}
                          maxLength={2048}
                          aria-label={`${getEmbedProviderLabel(resolvedEmbedProvider)} URL`}
                          className="bg-white text-black"
                        />
                      ) : (
                        <Textarea
                          value={embedData.snippet || ''}
                          onChange={(event) => updateEmbedData('snippet', event.target.value)}
                          placeholder={getEmbedProviderPlaceholder(resolvedEmbedProvider)}
                          maxLength={90000}
                          className="min-h-40 font-mono text-xs leading-5"
                        />
                      )}
                      {usesDirectEmbedUrl && (
                        <p className="text-[11px] leading-5 text-muted-foreground">
                          {resolvedEmbedProvider === 'google_calendar'
                            ? tr(
                                'In Google Calendar, open the booking page sharing options and paste its public URL or iframe source here.',
                                'In Google Calendar, apri le opzioni di condivisione della pagina di prenotazione e incolla qui il suo URL pubblico o il sorgente iframe.',
                              )
                            : resolvedEmbedProvider === 'calendly'
                              ? tr(
                                  'In Calendly, open the event type and paste its public scheduling link here.',
                                  'In Calendly, apri il tipo di evento e incolla qui il link pubblico di prenotazione.',
                                )
                              : resolvedEmbedProvider === 'typeform'
                                ? tr(
                                    'In Typeform, open Share and paste the public form link. OrbitPage uses the official Typeform widget.',
                                    'In Typeform, apri Condividi e incolla il link pubblico del modulo. OrbitPage usa il widget ufficiale Typeform.',
                                  )
                              : tr(
                                  `Paste the public share URL from ${getEmbedProviderLabel(resolvedEmbedProvider)}. OrbitPage converts it to the official embedded player and rejects unrelated domains.`,
                                  `Incolla l'URL pubblico di ${getEmbedProviderLabel(resolvedEmbedProvider)}. OrbitPage lo converte nel player ufficiale e rifiuta domini estranei.`,
                                )}
                        </p>
                      )}
                    </div>
                    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5 ${embedData.consentCategory === 'necessary' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {embedData.consentCategory === 'necessary'
                          ? 'Necessary loads before consent. Use it only for content that performs no tracking.'
                          : 'The provider receives no request until the visitor grants this consent category. The snippet then runs in an isolated sandbox.'}
                      </span>
                    </div>
                  </div>
                )}
                {editLink.type === 'cta' && (
                  <div className="space-y-1">
                    <Label className="text-xs">CTA action</Label>
                    <Select
                      value={editLink.ctaAction || 'book'}
                      onValueChange={(value: 'book' | 'contact' | 'download' | 'subscribe' | 'buy') =>
                        setEditLink(prev => ({ ...prev, ctaAction: value }))
                      }
                    >
                      <SelectTrigger className="h-8 bg-white text-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="book">Book</SelectItem>
                        <SelectItem value="contact">Contact me</SelectItem>
                        <SelectItem value="download">Download</SelectItem>
                        <SelectItem value="subscribe">Subscribe</SelectItem>
                        <SelectItem value="buy">Buy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

            {/* Link Scheduler */}
            <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Publishing</p>
                <p className="text-sm font-semibold text-slate-900">{isMenu ? tr('Menu availability schedule', 'Programmazione disponibilità menu') : tr('Status, campaign & schedule', 'Stato, campagna e programmazione')}</p>
              </div>
              {!schedulingEnabled && (
                <div className="admin-inline-plan-lock mb-3">
                  <LockKeyhole className="h-4 w-4" />
                  <span>Campaign scheduling is available on Pro.</span>
                  <a href={managePlanHref} target="_top">View plans</a>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {isActionable && (
                <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 sm:col-span-2">
                  <div>
                    <Label htmlFor={`availability-${link.id}`} className="text-sm font-medium text-slate-900">{tr('Available now', 'Disponibile ora')}</Label>
                    <p className="mt-0.5 text-xs text-slate-500">{tr('Keep the card visible but disable its destination when unavailable.', 'Mantieni visibile la card, ma disattiva la destinazione quando non è disponibile.')}</p>
                  </div>
                  <Switch
                    id={`availability-${link.id}`}
                    checked={editLink.availability !== 'unavailable'}
                    onCheckedChange={(checked) => setEditLink(prev => ({ ...prev, availability: checked ? 'available' : 'unavailable' }))}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={editLink.status || 'live'}
                  onValueChange={(value: 'draft' | 'live' | 'expired') => setEditLink(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="h-8 bg-white text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Campaign</Label>
                <Input
                  disabled={!schedulingEnabled}
                  value={editLink.campaignName || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, campaignName: e.target.value || undefined }))}
                  placeholder="Launch, event..."
                  className="h-8 w-full glass-card border-primary/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Show from date</Label>
                <Input
                  disabled={!schedulingEnabled}
                  type="date"
                  value={editLink.startDate || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, startDate: e.target.value || undefined }))}
                  className="h-8 w-full glass-card border-primary/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Show from time</Label>
                <Input
                  disabled={!schedulingEnabled}
                  type="time"
                  value={editLink.startTime || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, startTime: e.target.value || undefined }))}
                  className="h-8 w-full glass-card border-primary/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hide after date</Label>
                <Input
                  disabled={!schedulingEnabled}
                  type="date"
                  value={editLink.endDate || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, endDate: e.target.value || undefined }))}
                  className="h-8 w-full glass-card border-primary/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hide after time</Label>
                <Input
                  disabled={!schedulingEnabled}
                  type="time"
                  value={editLink.endTime || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, endTime: e.target.value || undefined }))}
                  className="h-8 w-full glass-card border-primary/20"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Timezone</Label>
                <Input
                  disabled={!schedulingEnabled}
                  value={editLink.timezone || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, timezone: e.target.value || undefined }))}
                  onFocus={() => {
                    if (!editLink.timezone) {
                      setEditLink(prev => ({ ...prev, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }));
                    }
                  }}
                  placeholder="Europe/Rome"
                  className="h-8 w-full glass-card border-primary/20"
                />
              </div>
              </div>
            </section>
              </>
            )}

            {isVideo && canEditImages && (
              <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                <div className="mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Video</p>
                  <p className="text-sm font-semibold text-slate-900">Uploaded media</p>
                </div>
                <div className="space-y-3">
                  {videoData.mediaUrl ? (
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                      <video src={videoData.mediaUrl} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute right-2 top-2 h-8 w-8"
                        onClick={() => updateVideoData('mediaUrl', '')}
                        title="Remove video"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Input
                      value={videoData.mediaUrl || ''}
                      onChange={(event) => updateVideoData('mediaUrl', event.target.value)}
                      placeholder="https://example.com/video.mp4"
                      className="glass-card border-primary/20 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={uploadingVideo || !videoUploadsEnabled}
                      title={videoUploadsEnabled ? "Upload video" : "Video uploads require Pro"}
                    >
                      {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : videoUploadsEnabled ? <Upload className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                    </Button>
                    <input ref={videoInputRef} type="file" accept={VIDEO_ACCEPT} onChange={handleVideoUpload} className="hidden" />
                  </div>
                  {uploadingVideo ? <p className="text-xs font-medium text-primary">Uploading and verifying: {videoUploadProgress}%</p> : null}
                  {videoUploadError ? <p className="text-xs font-medium text-destructive" role="alert">{videoUploadError}</p> : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ToggleSetting label="Show controls" checked={videoData.controls !== false} onCheckedChange={(value) => updateVideoData('controls', value)} />
                    <ToggleSetting label="Autoplay muted" checked={videoData.autoplay === true} onCheckedChange={(value) => updateVideoData('autoplay', value)} />
                    <ToggleSetting label="Loop" checked={videoData.loop === true} onCheckedChange={(value) => updateVideoData('loop', value)} />
                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <Label className="text-sm font-medium text-slate-900">Fit</Label>
                      <Select value={videoData.objectFit || 'cover'} onValueChange={(value: 'cover' | 'contain') => updateVideoData('objectFit', value)}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="cover">Cover</SelectItem><SelectItem value="contain">Contain</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">MP4 or WebM, up to {Math.round((maxVideoUploadBytes ?? DEFAULT_SELF_HOSTED_VIDEO_MAX_BYTES) / (1024 * 1024))} MB. Autoplay is always muted by the browser.</p>
                </div>
              </section>
            )}

            {/* Icon Upload */}
            {canEditImages && !isSeparator && !isSocialRow && (
            <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Media</p>
                <p className="text-sm font-semibold text-slate-900">Icon &amp; cover image</p>
              </div>
              <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Icon</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={editLink.icon || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, icon: e.target.value, iconType: 'emoji' }))}
                  placeholder="🔗 or emoji"
                  className="glass-card border-primary/20 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={Boolean(uploadingImage)}
                  title="Upload and optimize icon"
                >
                  {uploadingImage === "icon" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={RASTER_IMAGE_ACCEPT}
                  onChange={handleIconUpload}
                  className="hidden"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Image className="w-3.5 h-3.5" />
                Cover Image
              </Label>
              {editLink.coverImage && (
                <div className="relative w-full rounded-lg overflow-hidden bg-muted/20" style={{ aspectRatio: '16/9' }}>
                  <img
                    src={editLink.coverImage}
                    alt={editLink.coverImageAlt || ''}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setEditLink(prev => ({ ...prev, coverImage: undefined, coverImageAlt: undefined }))}
                    className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
                    title="Remove cover image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={editLink.coverImage && !editLink.coverImage.startsWith('data:') ? editLink.coverImage : ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, coverImage: e.target.value || undefined }))}
                  placeholder="https://example.com/image.jpg"
                  className="glass-card border-primary/20 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => coverImageInputRef.current?.click()}
                  title="Upload image"
                  disabled={Boolean(uploadingImage)}
                >
                  {uploadingImage === "cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </Button>
                <input
                  ref={coverImageInputRef}
                  type="file"
                  accept={RASTER_IMAGE_ACCEPT}
                  onChange={handleCoverImageUpload}
                  className="hidden"
                />
              </div>
              <Input
                value={editLink.coverImageAlt || ''}
                onChange={(e) => setEditLink(prev => ({ ...prev, coverImageAlt: e.target.value || undefined }))}
                placeholder="Image description (alt text, optional)"
                className="glass-card border-primary/20 text-sm"
              />
              {imageUploadError && <p className="text-xs font-medium text-destructive" role="alert">{imageUploadError}</p>}
              <p className="text-xs text-muted-foreground">Images up to 10 MB are optimized before upload.</p>
            </div>
              </div>
            </section>
            )}

            {canEditStyle && (
            <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Appearance</p>
                <p className="text-sm font-semibold text-slate-900">Size &amp; colors</p>
              </div>
              <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Card surface</Label>
              <Select
                value={editLink.surfaceEffect || 'inherit'}
                onValueChange={(surfaceEffect: CardSurfaceEffect | 'inherit') => setEditLink(prev => ({ ...prev, surfaceEffect }))}
              >
                <SelectTrigger className="glass-card border-primary/20 bg-white text-black dark:bg-gray-800 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Use theme default</SelectItem>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="transparent">Transparent</SelectItem>
                  <SelectItem value="liquid-glass">Liquid glass</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-slate-500">Transparent removes the surface. Liquid glass keeps the background visible with blur and a subtle rim.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Size</Label>
              <Select
                value={editLink.size || 'medium'}
                onValueChange={(value: 'small' | 'medium' | 'large') =>
                  setEditLink(prev => ({ ...prev, size: value }))
                }
              >
                <SelectTrigger className="glass-card border-primary/20 bg-white text-black dark:bg-gray-800 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={`grid gap-2 ${isSeparator && separatorData.boxed !== true ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {(!isSeparator || separatorData.boxed === true) && (
                <div className="space-y-1">
                  <Label className="text-xs">{isSeparator ? 'Full Background' : 'Background'}</Label>
                  <Input
                    type="color"
                    value={editLink.backgroundColor || inheritedBackgroundColor}
                    onChange={(e) => setEditLink(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="h-8 w-full"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">{isSeparator ? 'Line/Text Color' : 'Text Color'}</Label>
                <Input
                  type="color"
                  value={editLink.textColor || inheritedTextColor}
                  onChange={(e) => setEditLink(prev => ({ ...prev, textColor: e.target.value }))}
                  className="h-8 w-full"
                />
              </div>
            </div>
            {(editLink.backgroundColor || editLink.textColor) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-fit px-2 text-xs text-slate-600"
                onClick={() => setEditLink(prev => ({ ...prev, backgroundColor: undefined, textColor: undefined }))}
                title="Use theme colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Use theme colors
              </Button>
            )}
              </div>
            </section>
            )}
            
            <div className="flex gap-2">
              <Button aria-busy={Boolean(uploadingImage) || uploadingVideo || resolvingMap} onClick={handleSave} variant="gradient" size="sm" disabled={Boolean(uploadingImage) || uploadingVideo || resolvingMap}>
                {(uploadingImage || uploadingVideo || resolvingMap) && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploadingImage || uploadingVideo ? "Preparing media" : resolvingMap ? tr("Locating map", "Localizzazione mappa") : "Save"}
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm" disabled={Boolean(uploadingImage) || uploadingVideo || resolvingMap}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
            <div className="flex items-start justify-between">
            <div className="min-w-0">
              {renderReadOnlyBody()}
              {(link.status && link.status !== 'live') || link.campaignName || link.startDate || link.startTime || link.endDate || link.endTime ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {(link.status || 'live').toUpperCase()}
                  {link.campaignName ? ` · ${link.campaignName}` : ''}
                  {(link.startDate || link.startTime || link.endDate || link.endTime)
                    ? ` · ${link.startDate || 'any'} ${link.startTime || ''} -> ${link.endDate || 'any'} ${link.endTime || ''}`.trim()
                    : ''}
                </span>
              ) : null}
              {isCta && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  CTA clicks: {link.ctaClicks ?? 0}
                </span>
              )}
            </div>

            {canEdit && (
            <div className="admin-card-controls flex gap-1 opacity-0 group-hover:opacity-100 transition-smooth" onClick={(e) => e.stopPropagation()}>
              {canReorder && onMoveUp && (
                <Button
                  onClick={onMoveUp}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  title="Move up"
                  aria-label="Move up"
                >
                  ▲
                </Button>
              )}
              {canReorder && onMoveDown && (
                <Button
                  onClick={onMoveDown}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  title="Move down"
                  aria-label="Move down"
                >
                  ▼
                </Button>
              )}
              {isFullEdit && (
                <Button
                  onClick={() => onUpdate({ ...link, isActive: !isVisible })}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  title={isVisible ? 'Hide link' : 'Show link'}
                  aria-label={isVisible ? 'Hide link' : 'Show link'}
                >
                  {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                </Button>
              )}
              <Button
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                title="Edit block"
                aria-label="Edit block"
              >
                <Edit className="w-3 h-3" />
              </Button>
              {canDelete && (
                <Button
                  onClick={() => onDelete(link.id)}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-destructive hover:text-destructive"
                  title="Delete block"
                  aria-label="Delete block"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

const ToggleSetting = ({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
    <Label className="text-sm font-medium text-slate-900">{label}</Label>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);
