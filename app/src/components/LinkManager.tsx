import { type ComponentType, type CSSProperties, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarClock, Code2, Download, FileText, Film, Image, LayoutGrid, Link, List, LockKeyhole, MapPin, Minus, MousePointerClick, Palette, Plus, Search, Share2, Save, Tag, Type, Upload, UserCircle2, UtensilsCrossed } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LinkCard, LinkData } from "./LinkCard";
import { TextCard } from "./TextCard";
import { useToast } from "@/components/ui/use-toast";
import { isHostedRuntime, linkHealthApi, linksApi, type ManagedLinkHealth } from "@/lib/api-client";
import { LinkEditMode } from "@/lib/permissions";
import { commitWorkingLinks } from "./link-save-state";
import { type EmbedProvider, type LinkBlockType, type ServiceLinkProvider, buildBlockContent, getDefaultEmbedConsentCategory, getEmbedProviderDefaultHeight } from "@/lib/link-blocks";
import { getContentCardVariant, getContentCardVariantCssVariables, getThemeCssVariables, type ThemeConfig } from "@/lib/theme";
import { useAppI18n } from "@/lib/i18n";
import { createNativeMenuLink, isNativeMenuLink, upsertNativeMenuLink } from "@/lib/native-menu-link";
import { SiDeezer, SiGithub, SiGiphy, SiInstagram, SiSoundcloud, SiSpotify, SiTiktok, SiVimeo, SiWhatsapp, SiYoutube } from "react-icons/si";

interface LinkManagerProps {
  links: LinkData[];
  theme: ThemeConfig;
  editMode?: LinkEditMode;
  // Called only when user clicks Save
  onLinksUpdate: (links: LinkData[]) => void | Promise<void>;
  onLinksPreview?: (links: LinkData[]) => void;
  maxBlocks?: number | null;
  planName?: string;
  schedulingEnabled?: boolean;
  videoUploadsEnabled?: boolean;
  maxVideoUploadBytes?: number | null;
  managePlanHref?: string;
  nativeMenuEnabled?: boolean;
  publicPageHref?: string;
  availablePages?: Array<{ title: string; url: string }>;
}

type BlockLibraryCategoryId = "essential" | "services" | "structure" | "media" | "engagement";

interface BlockLibraryItem {
  id: string;
  title: string;
  description: string;
  keywords: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  badge?: string;
  restricted?: boolean;
}

const normalizeBlockSearch = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

export const LinkManager = ({
  links,
  theme,
  onLinksUpdate,
  onLinksPreview,
  editMode = 'full',
  maxBlocks,
  planName,
  schedulingEnabled = true,
  videoUploadsEnabled = true,
  maxVideoUploadBytes,
  managePlanHref = "/dashboard/billing",
  nativeMenuEnabled = true,
  publicPageHref = "/",
  availablePages = [],
}: LinkManagerProps) => {
  const { tr } = useAppI18n();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const touchDragRef = useRef<{ id: string; lastTarget: string | null } | null>(null);
  const { toast } = useToast();
  // Maintain a working copy to allow fluid drag reordering without spamming saves
  const [workingLinks, setWorkingLinks] = useState<LinkData[]>(links);
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);
  const [blockLibrarySearch, setBlockLibrarySearch] = useState("");
  const [blockLibraryCategory, setBlockLibraryCategory] = useState<"all" | BlockLibraryCategoryId>("all");
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [linkHealth, setLinkHealth] = useState<ManagedLinkHealth['results']>([]);
  const publicPreviewStyle = (index: number) => ({
    ...getThemeCssVariables(theme),
    ...getContentCardVariantCssVariables(theme, index),
  }) as CSSProperties;
  const atBlockLimit = maxBlocks !== undefined && maxBlocks !== null && workingLinks.length >= maxBlocks;

  const appendBlock = (block: LinkData) => {
    if (atBlockLimit) {
      toast({
        title: `${planName || tr("Current plan", "Piano attuale")}: ${tr("block limit reached", "limite blocchi raggiunto")}`,
        description: `${tr("This workspace can contain up to", "Questo workspace può contenere fino a")} ${maxBlocks} ${tr("blocks", "blocchi")}.`,
        variant: "destructive",
      });
      return;
    }
    setWorkingLinks((current) => [...current, block]);
    setIsDirty(true);
    setSaveError("");
    setIsBlockLibraryOpen(false);
  };

  const prependBlock = (block: LinkData) => {
    if (atBlockLimit) {
      toast({
        title: `${planName || tr("Current plan", "Piano attuale")}: ${tr("block limit reached", "limite blocchi raggiunto")}`,
        description: `${tr("This workspace can contain up to", "Questo workspace può contenere fino a")} ${maxBlocks} ${tr("blocks", "blocchi")}.`,
        variant: "destructive",
      });
      return;
    }
    setWorkingLinks((current) => [block, ...current]);
    setIsDirty(true);
    setSaveError("");
    setIsBlockLibraryOpen(false);
  };

  // Keep working copy in sync when parent provides a new links array
  useEffect(() => {
    // Replace working copy only when the incoming prop reference changes
    setWorkingLinks(links);
    setIsDirty(false);
    setSaveError("");
  }, [links]);

  useEffect(() => {
    onLinksPreview?.(workingLinks);
  }, [onLinksPreview, workingLinks]);

  useEffect(() => {
    if (!isHostedRuntime() || editMode === 'view') return;
    let active = true;
    const load = async () => {
      try {
        const initial = await linkHealthApi.get();
        if (!active) return;
        setLinkHealth(initial.results);
        if (initial.stale) {
          const refreshed = await linkHealthApi.refresh();
          if (active) setLinkHealth(refreshed.results);
        }
      } catch {
        // Link editing remains available when the background health check is unavailable.
      }
    };
    void load();
    return () => { active = false; };
  }, [editMode, links]);

  const addNewLink = () => {
    const newLink: LinkData = {
      id: Date.now().toString(),
      title: tr("New link", "Nuovo link"),
      description: "",
      url: "",
      type: "link",
      status: "live",
    };
    appendBlock(newLink);
  };

  const addNativeMenu = () => {
    if (!nativeMenuEnabled) {
      toast({
        title: tr("Menu requires Starter", "Il menu richiede Starter"),
        description: tr("Upgrade the workspace to add a native menu card.", "Aggiorna il workspace per aggiungere una card menu nativa."),
        variant: "destructive",
      });
      return;
    }

    const menuLink = createNativeMenuLink(publicPageHref, {
      title: tr("View menu", "Vedi il menu"),
      description: tr("Browse food and drinks", "Scopri piatti e bevande"),
    });
    const existingMenu = workingLinks.find(isNativeMenuLink);

    if (existingMenu) {
      setWorkingLinks((current) => upsertNativeMenuLink(current, menuLink));
      setIsDirty(true);
      setSaveError("");
      setIsBlockLibraryOpen(false);
      toast({
        title: tr("Menu card refreshed", "Card menu aggiornata"),
        description: tr("The existing card now points to the native menu.", "La card esistente ora punta al menu nativo."),
      });
      return;
    }

    appendBlock(menuLink);
  };

  const addNewCta = () => {
    const newCta: LinkData = {
      id: Date.now().toString(),
      title: tr("Book now", "Prenota ora"),
      description: "",
      url: "",
      type: "cta",
      ctaAction: "book",
      status: "live",
      size: "large",
    };
    appendBlock(newCta);
  };

  const addNewTextCard = () => {
    const newTextCard: LinkData = {
      id: Date.now().toString(),
      title: "New text",
      description: "",
      url: "",
      type: "text",
      content: "",
      status: "live",
    };
    appendBlock(newTextCard);
  };

  // Create a bulleted list text card (clickable list items)
  const addNewBulletedList = () => {
    const newListCard: LinkData = {
      id: Date.now().toString(),
      title: "New list",
      description: "",
      url: "",
      type: "text",
      textItems: [],
      status: "live",
    };
    appendBlock(newListCard);
  };

  const addNewSeparator = () => {
    const newSeparator: LinkData = {
      id: Date.now().toString(),
      title: 'Section',
      description: '',
      url: '',
      type: 'separator',
      content: buildBlockContent({ boxed: false }),
      isActive: true,
    };
    appendBlock(newSeparator);
  };

  const addNewHeading = () => {
    const newHeading: LinkData = {
      id: Date.now().toString(),
      title: "New heading",
      description: "",
      url: "",
      type: "heading",
      status: "live",
    };
    appendBlock(newHeading);
  };

  const addNewImage = () => {
    const newImage: LinkData = {
      id: Date.now().toString(),
      title: "Image block",
      description: "",
      url: "",
      type: "image",
      status: "live",
    };
    appendBlock(newImage);
  };

  const addNewVideo = () => {
    if (!videoUploadsEnabled) {
      toast({
        title: "Video requires Pro",
        description: "Upgrade the workspace to add uploaded video blocks.",
        variant: "destructive",
      });
      return;
    }
    appendBlock({
      id: Date.now().toString(),
      title: "Video",
      description: "",
      url: "",
      type: "video",
      content: buildBlockContent({
        mediaUrl: "",
        posterUrl: "",
        controls: true,
        autoplay: false,
        loop: false,
        muted: true,
        objectFit: "cover",
      }),
      status: "live",
    });
  };

  const addNewContact = () => {
    const newContact: LinkData = {
      id: Date.now().toString(),
      title: "Contact",
      description: "",
      url: "",
      type: "contact",
      content: buildBlockContent({
        name: "",
        title: "",
        role: "",
        phone: "",
        email: "",
        website: "",
        address: "",
        note: "",
        whatsapp: "",
        telegram: "",
      }),
      status: "live",
    };
    appendBlock(newContact);
  };

  const addNewSocialRow = () => {
    if (workingLinks.some((item) => item.type === 'social_row')) {
      setIsBlockLibraryOpen(false);
      toast({
        title: tr("Quick links already added", "Link rapidi già aggiunti"),
        description: tr("Edit the existing icon row near the top of the page.", "Modifica la riga di icone già presente in alto nella pagina."),
      });
      return;
    }
    const newSocialRow: LinkData = {
      id: Date.now().toString(),
      title: "Quick links",
      description: "",
      url: "",
      type: "social_row",
      content: buildBlockContent({
        items: [],
        layout: "icons",
        iconStyle: "brand",
        columns: 3,
        boxed: false,
        showTitle: false,
        showLabels: false,
      }),
      status: "live",
    };
    prependBlock(newSocialRow);
  };

  const addNewCallout = () => {
    const newCallout: LinkData = {
      id: Date.now().toString(),
      title: "Callout",
      description: "",
      url: "",
      type: "callout",
      content: buildBlockContent({
        badge: "Info",
        buttonLabel: "Open",
      }),
      status: "live",
    };
    appendBlock(newCallout);
  };

  const addNewMap = () => {
    const newMap: LinkData = {
      id: Date.now().toString(),
      title: "Map",
      description: "",
      url: "",
      type: "map",
      content: buildBlockContent({
        placeName: "",
        address: "",
        mapUrl: "",
      }),
      status: "live",
    };
    appendBlock(newMap);
  };

  const addNewEvent = () => {
    const newEvent: LinkData = {
      id: Date.now().toString(),
      title: "Event",
      description: "",
      url: "",
      type: "event",
      content: buildBlockContent({
        date: "",
        time: "",
        endDate: "",
        endTime: "",
        location: "",
        ticketLabel: "Get ticket",
        notes: "",
      }),
      status: "live",
    };
    appendBlock(newEvent);
  };

  const addNewEmbed = () => {
    const newEmbed: LinkData = {
      id: Date.now().toString(),
      title: "Embed",
      description: "",
      url: "",
      type: "embed",
      content: buildBlockContent({
        provider: "auto",
        consentCategory: "marketing",
        height: 360,
        snippet: "",
      }),
      status: "live",
    };
    appendBlock(newEmbed);
  };

  const addServiceEmbed = (
    provider: Extract<EmbedProvider, "instagram" | "youtube" | "spotify" | "deezer" | "soundcloud" | "vimeo" | "tiktok" | "giphy">,
    title: string,
    description: string,
  ) => {
    const newEmbed: LinkData = {
      id: Date.now().toString(),
      title,
      description,
      url: "",
      type: "embed",
      content: buildBlockContent({
        provider,
        consentCategory: getDefaultEmbedConsentCategory(provider),
        height: getEmbedProviderDefaultHeight(provider),
        snippet: "",
      }),
      status: "live",
    };
    appendBlock(newEmbed);
  };

  const addServiceLink = (service: ServiceLinkProvider, title: string, description: string) => {
    const newLink: LinkData = {
      id: Date.now().toString(),
      title,
      description,
      url: "",
      hideUrl: true,
      type: "link",
      content: buildBlockContent({ service }),
      status: "live",
    };
    appendBlock(newLink);
  };

  const updateLink = (updatedLink: LinkData) => {
    const updatedLinks = workingLinks.map(link => 
      String(link.id) === String(updatedLink.id) ? updatedLink : link
    );
    setWorkingLinks(updatedLinks);
    setIsDirty(true);
    setSaveError("");
  };

  const deleteLink = (id: string) => {
    const updatedLinks = workingLinks.filter(link => String(link.id) !== String(id));
    setWorkingLinks(updatedLinks);
    setIsDirty(true);
    setSaveError("");
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const performReorder = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    const draggedIndex = workingLinks.findIndex(link => String(link.id) === String(fromId));
    const targetIndex = workingLinks.findIndex(link => String(link.id) === String(toId));
    if (draggedIndex === -1 || targetIndex === -1) return;
    const newLinks = [...workingLinks];
    const [draggedLink] = newLinks.splice(draggedIndex, 1);
    newLinks.splice(targetIndex, 0, draggedLink);
    setWorkingLinks(newLinks);
    setIsDirty(true);
    setSaveError("");
    return newLinks;
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;
    const newOrder = performReorder(draggedItem, targetId);
    setDraggedItem(null);
    setDragOverId(null);
    // Do not persist here; wait for explicit Save
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverId(null);
  };

  // --- Touch drag & drop (mobile) ---
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    touchDragRef.current = { id, lastTarget: null };
    setDraggedItem(id);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragRef.current) return;
    e.preventDefault(); // prevent page scroll while dragging
    const touch = e.touches[0];
    const cardElements = document.querySelectorAll<HTMLElement>('[data-link-id]');
    for (const el of Array.from(cardElements)) {
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const targetId = el.dataset.linkId!;
        if (targetId !== touchDragRef.current.id && targetId !== touchDragRef.current.lastTarget) {
          touchDragRef.current.lastTarget = targetId;
          setDragOverId(targetId);
          performReorder(touchDragRef.current.id, targetId);
        }
        break;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDragRef.current = null;
    setDraggedItem(null);
    setDragOverId(null);
  };

  const handleDragEnter = (targetId: string) => {
    if (!draggedItem || draggedItem === targetId) return;
    setDragOverId(targetId);
    // Reorder locally for fluid UX; do not persist until drop
    performReorder(draggedItem, targetId);
  };

  // Export links as JSON
  const exportLinks = async () => {
    try {
      setBusy(true);
      const blob = await (await import('@/lib/api-client')).linksApi.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'links-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "Links exported successfully",
        variant: "default"
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export links",
        variant: "destructive"
      });
    } finally {
      setBusy(false);
    }
  };

  // Import links from JSON
  const importLinks = async (file: File) => {
    try {
      setBusy(true);
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid file format: Expected an array of links');
      }

      const { linksApi } = await import('@/lib/api-client');
      await linksApi.import(data);
      
      // Refresh the links after successful import
        const updatedLinks = await linksApi.get();
      setWorkingLinks(updatedLinks.map(link => ({
        ...link,
        type: link.type as LinkBlockType,
      })));
      setIsDirty(false);
      setSaveError("");
      
      toast({
        title: "Import Successful",
        description: `Imported ${data.length} links successfully`,
        variant: "default"
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import links",
        variant: "destructive"
      });
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) await importLinks(file);
    };
    input.click();
  };

  const moveByOffset = (id: string, delta: number) => {
    const index = workingLinks.findIndex(l => String(l.id) === String(id));
    if (index === -1) return;
    const newIndex = Math.max(0, Math.min(workingLinks.length - 1, index + delta));
    if (newIndex === index) return;
    const newLinks = [...workingLinks];
    const [item] = newLinks.splice(index, 1);
    newLinks.splice(newIndex, 0, item);
    setWorkingLinks(newLinks);
    setIsDirty(true);
    setSaveError("");
  };

  const handleSave = async () => {
    if (!isDirty) return;
    setBusy(true);
    setSaveError("");
    const result = await commitWorkingLinks({
      isDirty,
      links: workingLinks,
      onSave: onLinksUpdate,
    });
    setIsDirty(result.isDirty);
    setSaveError(result.error);
    setBusy(false);
  };

  const isFullEdit = editMode === 'full';
  const isViewOnly = editMode === 'view';
  const hasCompactLinks = workingLinks.some((item) => item.type === "social_row");
  const blockLibraryCategories: Array<{
    id: BlockLibraryCategoryId;
    label: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    items: BlockLibraryItem[];
  }> = [
    {
      id: "essential",
      label: tr("Essentials", "Essenziali"),
      description: tr("The blocks most pages start with.", "I blocchi da cui parte la maggior parte delle pagine."),
      icon: LayoutGrid,
      items: [
        { id: "link", title: "Link", description: tr("A clear card for any destination.", "Una card chiara per qualsiasi destinazione."), keywords: "url website destination sito", icon: Link, onSelect: addNewLink },
        { id: "compact-links", title: tr("Compact links", "Link compatti"), description: tr("Social profiles and page shortcuts.", "Profili social e collegamenti alle pagine."), keywords: "social icons instagram facebook shortcut icone", icon: Share2, onSelect: addNewSocialRow, badge: hasCompactLinks ? tr("Added", "Aggiunto") : undefined, restricted: hasCompactLinks },
        { id: "contact", title: tr("Contact", "Contatto"), description: tr("Phone, email and useful contact details.", "Telefono, email e contatti utili."), keywords: "phone email whatsapp telefono contatti", icon: UserCircle2, onSelect: addNewContact },
        { id: "cta", title: "CTA", description: tr("A prominent action such as booking or buying.", "Un'azione in evidenza, come prenotare o acquistare."), keywords: "action booking buy prenota acquista button", icon: MousePointerClick, onSelect: addNewCta },
      ],
    },
    {
      id: "services",
      label: tr("Connected services", "Servizi collegati"),
      description: tr("Add branded social content, media players and direct actions.", "Aggiungi contenuti social, player multimediali e azioni dirette con il relativo brand."),
      icon: Share2,
      items: [
        { id: "instagram", title: "Instagram", description: tr("Embed a public post or Reel.", "Incorpora un post pubblico o un Reel."), keywords: "instagram post reel social", icon: SiInstagram, onSelect: () => addServiceEmbed("instagram", "Instagram", tr("Latest from Instagram", "Da Instagram")) },
        { id: "whatsapp", title: "WhatsApp", description: tr("Open a direct chat or booking conversation.", "Apri una chat diretta o una conversazione per prenotare."), keywords: "whatsapp chat message booking telefono messaggio", icon: SiWhatsapp, onSelect: () => addServiceLink("whatsapp", "WhatsApp", tr("Chat with us", "Scrivici")) },
        { id: "youtube", title: "YouTube", description: tr("Play a video with the privacy-enhanced player.", "Riproduci un video con il player a privacy avanzata."), keywords: "youtube video player", icon: SiYoutube, onSelect: () => addServiceEmbed("youtube", "YouTube", tr("Watch the video", "Guarda il video")) },
        { id: "spotify", title: "Spotify", description: tr("Play a track, album, playlist or podcast.", "Riproduci un brano, album, playlist o podcast."), keywords: "spotify song track album playlist podcast music musica", icon: SiSpotify, onSelect: () => addServiceEmbed("spotify", "Spotify", tr("Listen on Spotify", "Ascolta su Spotify")) },
        { id: "deezer", title: "Deezer", description: tr("Play a track, album or playlist.", "Riproduci un brano, album o playlist."), keywords: "deezer song track album playlist music musica", icon: SiDeezer, onSelect: () => addServiceEmbed("deezer", "Deezer", tr("Listen on Deezer", "Ascolta su Deezer")) },
        { id: "soundcloud", title: "SoundCloud", description: tr("Play a public track or set.", "Riproduci un brano o set pubblico."), keywords: "soundcloud track set dj audio music musica", icon: SiSoundcloud, onSelect: () => addServiceEmbed("soundcloud", "SoundCloud", tr("Listen on SoundCloud", "Ascolta su SoundCloud")) },
        { id: "vimeo", title: "Vimeo", description: tr("Show a Vimeo video in an embedded player.", "Mostra un video Vimeo nel player incorporato."), keywords: "vimeo video player", icon: SiVimeo, onSelect: () => addServiceEmbed("vimeo", "Vimeo", tr("Watch the video", "Guarda il video")) },
        { id: "tiktok", title: "TikTok", description: tr("Embed a public TikTok video.", "Incorpora un video TikTok pubblico."), keywords: "tiktok video social", icon: SiTiktok, onSelect: () => addServiceEmbed("tiktok", "TikTok", tr("Watch on TikTok", "Guarda su TikTok")) },
        { id: "giphy", title: "Giphy", description: tr("Embed an animated GIF without uploading it.", "Incorpora una GIF animata senza caricarla."), keywords: "giphy gif animation animated", icon: SiGiphy, onSelect: () => addServiceEmbed("giphy", "Giphy", tr("Animated GIF", "GIF animata")) },
        { id: "github", title: "GitHub", description: tr("Link a repository, profile or release.", "Collega repository, profilo o release."), keywords: "github repository repo code profile release codice", icon: SiGithub, onSelect: () => addServiceLink("github", "GitHub", tr("View on GitHub", "Apri su GitHub")) },
      ],
    },
    {
      id: "structure",
      label: tr("Writing & structure", "Testo e struttura"),
      description: tr("Organize information and make it easier to scan.", "Organizza le informazioni e rendile più facili da leggere."),
      icon: FileText,
      items: [
        { id: "heading", title: tr("Heading", "Titolo"), description: tr("Introduce a new section of the page.", "Introduce una nuova sezione della pagina."), keywords: "title section heading titolo", icon: Type, onSelect: addNewHeading },
        { id: "text", title: tr("Text", "Testo"), description: tr("Add freeform copy and longer descriptions.", "Aggiungi testo libero e descrizioni più lunghe."), keywords: "copy paragraph description testo paragrafo", icon: FileText, onSelect: addNewTextCard },
        { id: "list", title: tr("List", "Elenco"), description: tr("Group short items into a readable list.", "Raggruppa elementi brevi in un elenco leggibile."), keywords: "list bullets items elenco punti", icon: List, onSelect: addNewBulletedList },
        { id: "separator", title: tr("Separator", "Separatore"), description: tr("Create visual rhythm between sections.", "Crea ritmo visivo tra le sezioni."), keywords: "divider section label separatore divisore", icon: Minus, onSelect: addNewSeparator },
      ],
    },
    {
      id: "media",
      label: tr("Media & embeds", "Media e incorporamenti"),
      description: tr("Show visual content and external experiences.", "Mostra contenuti visivi ed esperienze esterne."),
      icon: Image,
      items: [
        { id: "image", title: tr("Image", "Immagine"), description: tr("Add a photo or visual feature block.", "Aggiungi una foto o un blocco visivo."), keywords: "photo picture image foto immagine", icon: Image, onSelect: addNewImage },
        { id: "video", title: "Video", description: videoUploadsEnabled ? "MP4 / WebM" : tr("Available on Pro.", "Disponibile con Pro."), keywords: "movie mp4 webm video", icon: Film, onSelect: addNewVideo, badge: !videoUploadsEnabled ? "Pro" : undefined, restricted: !videoUploadsEnabled },
        { id: "embed", title: "Embed", description: tr("Video, music, booking and supported widgets.", "Video, musica, prenotazioni e widget supportati."), keywords: "youtube spotify booking widget iframe embed", icon: Code2, onSelect: addNewEmbed },
        { id: "map", title: tr("Map", "Mappa"), description: tr("Show a place with a reliable map preview.", "Mostra un luogo con un'anteprima mappa affidabile."), keywords: "location maps address luogo indirizzo mappa", icon: MapPin, onSelect: addNewMap },
      ],
    },
    {
      id: "engagement",
      label: tr("Engagement", "Coinvolgimento"),
      description: tr("Promote timely offers, events and menus.", "Promuovi offerte, eventi e menu nel momento giusto."),
      icon: CalendarClock,
      items: [
        { id: "event", title: tr("Event", "Evento"), description: tr("Feature a date, time and countdown.", "Metti in evidenza data, ora e conto alla rovescia."), keywords: "calendar countdown date evento calendario data", icon: CalendarClock, onSelect: addNewEvent },
        { id: "callout", title: "Callout", description: tr("Highlight a promotion or important update.", "Evidenzia una promozione o un aggiornamento importante."), keywords: "promo offer update announcement offerta avviso", icon: Tag, onSelect: addNewCallout },
        { id: "menu", title: "Menu", description: nativeMenuEnabled ? tr("Open the native food and drinks menu.", "Apri il menu nativo di cibi e bevande.") : tr("Available from Starter.", "Disponibile da Starter."), keywords: "restaurant bar food drinks ristorante cibo bevande", icon: nativeMenuEnabled ? UtensilsCrossed : LockKeyhole, onSelect: addNativeMenu, badge: !nativeMenuEnabled ? "Starter" : undefined, restricted: !nativeMenuEnabled },
      ],
    },
  ];
  const normalizedBlockSearch = normalizeBlockSearch(blockLibrarySearch);
  const visibleBlockLibraryCategories = blockLibraryCategories
    .filter((category) => blockLibraryCategory === "all" || category.id === blockLibraryCategory)
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => normalizeBlockSearch([
        item.title,
        item.description,
        item.keywords,
        category.label,
      ].join(" ")).includes(normalizedBlockSearch)),
    }))
    .filter((category) => category.items.length > 0);
  const visibleBlockCount = visibleBlockLibraryCategories.reduce((total, category) => total + category.items.length, 0);

  const openBlockLibrary = () => {
    setBlockLibrarySearch("");
    setBlockLibraryCategory("all");
    setIsBlockLibraryOpen(true);
  };

  return (
    <div className="admin-link-manager">
      {!isFullEdit && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
          isViewOnly
            ? 'border-slate-200 bg-slate-50 text-slate-600'
            : 'border-blue-200 bg-blue-50 text-blue-700'
        }`}>
          {editMode === 'style' && <><Palette className="h-4 w-4 shrink-0" /><span>{tr("Style editor — you can edit card colors, fonts, and size.", "Editor stile: puoi modificare colori, caratteri e dimensioni delle card.")}</span></>}
          {editMode === 'images' && <><Image className="h-4 w-4 shrink-0" /><span>{tr("Image editor — you can edit card icons and cover images.", "Editor immagini: puoi modificare icone e copertine delle card.")}</span></>}
          {editMode === 'view' && <span>{tr("View-only — you do not have permission to edit links.", "Sola lettura: non hai il permesso di modificare i link.")}</span>}
        </div>
      )}

      <div className="admin-link-toolbar" data-onboarding="links-toolbar">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">{tr("Content cards", "Card dei contenuti")}</h2>
            {isDirty && <span className="admin-dirty-badge">{tr("Unsaved changes", "Modifiche non salvate")}</span>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {workingLinks.length === 0
              ? tr("Start with a block, then arrange your public page.", "Inizia con un blocco, poi organizza la pagina pubblica.")
              : `${workingLinks.length}${maxBlocks !== undefined && maxBlocks !== null ? ` ${tr("of", "di")} ${maxBlocks}` : ""} ${tr("blocks in your public page order.", "blocchi nell'ordine della pagina pubblica.")}`}
          </p>
          {saveError && (
            <p className="mt-2 text-sm font-medium text-red-600" role="alert">
              {saveError}
            </p>
          )}
        </div>

        <div className="admin-link-actions">
          {isFullEdit && (
            <Button
              onClick={openBlockLibrary}
              variant="outline"
              className="admin-action"
              disabled={atBlockLimit}
              aria-expanded={isBlockLibraryOpen}
              aria-controls="admin-block-library"
            >
              <Plus className="h-4 w-4" />
              {tr("Add content", "Aggiungi contenuto")}
            </Button>
          )}
          {!isViewOnly && (
            <Button onClick={handleSave} className="admin-action admin-action-primary" disabled={!isDirty || busy} data-onboarding="links-save">
              <Save className="h-4 w-4" />
              {tr("Save", "Salva")}
            </Button>
          )}
          <Button onClick={exportLinks} variant="outline" size="icon" className="admin-action" disabled={busy} aria-label={tr("Export links", "Esporta link")} title={tr("Export links", "Esporta link")}>
            <Download className="h-4 w-4" />
          </Button>
          {isFullEdit && (
            <Button onClick={handleImportFile} variant="outline" size="icon" className="admin-action" disabled={busy} aria-label={tr("Import links", "Importa link")} title={tr("Import links", "Importa link")}>
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {atBlockLimit && (
        <div className="admin-inline-plan-lock mb-4">
          <LockKeyhole className="h-4 w-4" />
          <span>{planName || tr("Your plan", "Il tuo piano")} {tr("includes up to", "include fino a")} {maxBlocks} {tr("blocks. Existing blocks remain editable.", "blocchi. I blocchi esistenti restano modificabili.")}</span>
          <a href={managePlanHref} target="_top">{tr("View plans", "Vedi i piani")}</a>
        </div>
      )}

      {isFullEdit && (
        <Dialog open={isBlockLibraryOpen} onOpenChange={setIsBlockLibraryOpen}>
          <DialogContent
            id="admin-block-library"
            className="admin-block-library-dialog"
            overlayClassName="admin-block-library-overlay"
            data-onboarding="link-add-grid"
          >
            <DialogHeader className="admin-block-library-dialog-header">
              <p className="admin-block-library-kicker">{tr("Block library", "Libreria blocchi")}</p>
              <DialogTitle>{tr("Add content", "Aggiungi contenuto")}</DialogTitle>
              <DialogDescription>
                {tr(
                  "Find the right block, then add it to your public page.",
                  "Trova il blocco giusto e aggiungilo alla pagina pubblica."
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="admin-block-library-search">
              <Search className="h-4 w-4" aria-hidden="true" />
              <Input
                autoFocus
                value={blockLibrarySearch}
                onChange={(event) => setBlockLibrarySearch(event.target.value)}
                placeholder={tr("Search blocks", "Cerca blocchi")}
                aria-label={tr("Search blocks", "Cerca blocchi")}
              />
            </div>

            <div className="admin-block-library-body">
              <nav className="admin-block-library-filters" aria-label={tr("Block categories", "Categorie dei blocchi")}>
                <button
                  type="button"
                  className={blockLibraryCategory === "all" ? "is-active" : ""}
                  onClick={() => setBlockLibraryCategory("all")}
                  aria-pressed={blockLibraryCategory === "all"}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span>{tr("All blocks", "Tutti i blocchi")}</span>
                  <small>{blockLibraryCategories.reduce((total, category) => total + category.items.length, 0)}</small>
                </button>
                {blockLibraryCategories.map((category) => {
                  const CategoryIcon = category.icon;
                  return (
                    <button
                      type="button"
                      key={category.id}
                      className={blockLibraryCategory === category.id ? "is-active" : ""}
                      onClick={() => setBlockLibraryCategory(category.id)}
                      aria-pressed={blockLibraryCategory === category.id}
                    >
                      <CategoryIcon className="h-4 w-4" />
                      <span>{category.label}</span>
                      <small>{category.items.length}</small>
                    </button>
                  );
                })}
              </nav>

              <div className="admin-block-library-results">
                <div className="admin-block-library-results-heading">
                  <span>{visibleBlockCount} {tr(visibleBlockCount === 1 ? "block" : "blocks", visibleBlockCount === 1 ? "blocco" : "blocchi")}</span>
                  {normalizedBlockSearch && (
                    <button type="button" onClick={() => setBlockLibrarySearch("")}>
                      {tr("Clear search", "Cancella ricerca")}
                    </button>
                  )}
                </div>

                <ScrollArea className="admin-block-library-scroll">
                  <div className="admin-block-library-sections">
                    {visibleBlockLibraryCategories.map((category) => {
                      const CategoryIcon = category.icon;
                      return (
                        <section key={category.id} className="admin-block-category">
                          <div className="admin-block-category-heading">
                            <span className="admin-block-category-icon"><CategoryIcon className="h-4 w-4" /></span>
                            <div>
                              <h3>{category.label}</h3>
                              <p>{category.description}</p>
                            </div>
                          </div>
                          <div className="admin-block-category-grid">
                            {category.items.map((item) => {
                              const ItemIcon = item.icon;
                              return (
                                <button
                                  type="button"
                                  key={item.id}
                                  className="admin-block-library-item"
                                  onClick={item.onSelect}
                                  aria-disabled={item.restricted || undefined}
                                >
                                  <span className="admin-block-library-item-icon">
                                    <ItemIcon className="h-5 w-5" />
                                  </span>
                                  <span className="admin-block-library-item-copy">
                                    <strong>{item.title}</strong>
                                    <small>{item.description}</small>
                                  </span>
                                  {item.badge && <span className="admin-block-library-item-badge">{item.badge}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                    {visibleBlockCount === 0 && (
                      <div className="admin-block-library-empty">
                        <Search className="h-5 w-5" />
                        <strong>{tr("No blocks found", "Nessun blocco trovato")}</strong>
                        <p>{tr("Try a different word or choose another category.", "Prova un'altra parola o scegli una categoria diversa.")}</p>
                        <button type="button" onClick={() => {
                          setBlockLibrarySearch("");
                          setBlockLibraryCategory("all");
                        }}>
                          {tr("Show all blocks", "Mostra tutti i blocchi")}
                        </button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {workingLinks.length === 0 ? (
        <Card className="admin-empty-state">
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-slate-950">{tr("No content yet", "Nessun contenuto")}</h3>
                <p className="text-sm leading-6 text-slate-600">
                  {tr("Add a first card, then drag items into the order you want.", "Aggiungi la prima card, poi trascina gli elementi nell'ordine desiderato.")}
                </p>
              </div>
              {isFullEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={addNewLink} className="admin-action admin-action-primary" disabled={atBlockLimit}>
                    <Link className="h-4 w-4" />
                    {tr("Add link", "Aggiungi link")}
                  </Button>
                  <Button onClick={addNativeMenu} variant="outline" className="admin-action" disabled={atBlockLimit}>
                    {nativeMenuEnabled ? <UtensilsCrossed className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                    {tr("Add menu", "Aggiungi menu")}
                  </Button>
                  <Button onClick={addNewBulletedList} variant="outline" className="admin-action" disabled={atBlockLimit}>
                    <List className="h-4 w-4" />
                    {tr("Add list", "Aggiungi elenco")}
                  </Button>
                  <Button onClick={addNewHeading} variant="outline" className="admin-action" disabled={atBlockLimit}>
                    <Type className="h-4 w-4" />
                    {tr("Add heading", "Aggiungi titolo")}
                  </Button>
                </div>
              )}
            </div>
        </Card>
      ) : (
        <div className="admin-link-list">
          {workingLinks.map((link, index) => (
            <div
              key={link.id}
              data-link-id={link.id}
              draggable={isFullEdit}
              onDragStart={isFullEdit ? (e) => handleDragStart(e, link.id) : undefined}
              onDragOver={isFullEdit ? handleDragOver : undefined}
              onDragEnter={isFullEdit ? () => handleDragEnter(link.id) : undefined}
              onDrop={isFullEdit ? (e) => handleDrop(e, link.id) : undefined}
              onDragEnd={isFullEdit ? handleDragEnd : undefined}
              onTouchStart={isFullEdit ? (e) => handleTouchStart(e, link.id) : undefined}
              onTouchMove={isFullEdit ? handleTouchMove : undefined}
              onTouchEnd={isFullEdit ? handleTouchEnd : undefined}
              className={dragOverId === link.id ? 'rounded-lg ring-2 ring-blue-400/50' : ''}
            >
              {link.type === 'text' ? (
                <TextCard
                  link={link}
                  onUpdate={updateLink}
                  onDelete={deleteLink}
                  isDragging={draggedItem === link.id}
                  onMoveUp={() => moveByOffset(link.id, -1)}
                  onMoveDown={() => moveByOffset(link.id, 1)}
                  editMode={editMode}
                  publicPreviewStyle={publicPreviewStyle(index)}
                  inheritedBackgroundColor={getContentCardVariant(theme, index).background}
                  inheritedTextColor={getContentCardVariant(theme, index).foreground}
                  schedulingEnabled={schedulingEnabled}
                  videoUploadsEnabled={videoUploadsEnabled}
                  maxVideoUploadBytes={maxVideoUploadBytes}
                  managePlanHref={managePlanHref}
                />
              ) : (
                <LinkCard
                  link={link}
                  onUpdate={updateLink}
                  onDelete={deleteLink}
                  onMoveUp={() => moveByOffset(link.id, -1)}
                  onMoveDown={() => moveByOffset(link.id, 1)}
                  isDragging={draggedItem === link.id}
                  editMode={editMode}
                  publicPreviewStyle={publicPreviewStyle(index)}
                  inheritedBackgroundColor={getContentCardVariant(theme, index).background}
                  inheritedTextColor={getContentCardVariant(theme, index).foreground}
                  schedulingEnabled={schedulingEnabled}
                  managePlanHref={managePlanHref}
                  health={linkHealth.find((item) => item.id === link.id)}
                  availablePages={availablePages}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
