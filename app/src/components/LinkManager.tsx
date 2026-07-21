import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarClock, Code2, Download, Film, Image, Link, List, LockKeyhole, Minus, MapPin, MousePointerClick, Palette, Plus, Share2, Save, Tag, Type, Upload, UserCircle2, UtensilsCrossed, X } from "lucide-react";
import { LinkCard, LinkData } from "./LinkCard";
import { TextCard } from "./TextCard";
import { useToast } from "@/components/ui/use-toast";
import { isHostedRuntime, linkHealthApi, linksApi, type ManagedLinkHealth } from "@/lib/api-client";
import { LinkEditMode } from "@/lib/permissions";
import { commitWorkingLinks } from "./link-save-state";
import { type LinkBlockType, buildBlockContent } from "@/lib/link-blocks";
import { getContentCardVariant, getContentCardVariantCssVariables, getThemeCssVariables, type ThemeConfig } from "@/lib/theme";
import { useAppI18n } from "@/lib/i18n";
import { createNativeMenuLink, isNativeMenuLink, upsertNativeMenuLink } from "@/lib/native-menu-link";

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
        showLabels: true,
      }),
      status: "live",
    };
    appendBlock(newSocialRow);
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
              onClick={() => setIsBlockLibraryOpen((open) => !open)}
              variant="outline"
              className="admin-action"
              disabled={atBlockLimit}
              aria-expanded={isBlockLibraryOpen}
              aria-controls="admin-block-library"
            >
              <Plus className="h-4 w-4" />
              {isBlockLibraryOpen ? tr("Close library", "Chiudi libreria") : tr("Add block", "Aggiungi blocco")}
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

      {isFullEdit && isBlockLibraryOpen && (
        <>
          <button
            type="button"
            className="admin-block-library-backdrop"
            aria-label={tr("Close block library", "Chiudi libreria blocchi")}
            onClick={() => setIsBlockLibraryOpen(false)}
          />
          <section id="admin-block-library" className="admin-block-library" data-onboarding="link-add-grid">
            <div className="admin-block-library-heading mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">{tr("Block library", "Libreria blocchi")}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950">{tr("Add content", "Aggiungi contenuto")}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("Choose a block to append it to the public page.", "Scegli un blocco da aggiungere alla pagina pubblica.")}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="admin-block-library-close"
                onClick={() => setIsBlockLibraryOpen(false)}
                aria-label={tr("Close block library", "Chiudi libreria blocchi")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="admin-add-grid">
          <Button onClick={addNewLink} className="admin-add-card">
            <span className="admin-add-icon">
              <Link className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Link</span>
              <span className="block text-xs opacity-70">{tr("URL card", "Card URL")}</span>
            </span>
          </Button>
          <Button
            onClick={addNativeMenu}
            variant="outline"
            className="admin-add-card"
            aria-disabled={!nativeMenuEnabled}
            title={!nativeMenuEnabled
              ? tr("Native menus require Starter", "I menu nativi richiedono Starter")
              : tr("Add a ready-made card for your menu", "Aggiungi una card pronta per il tuo menu")}
          >
            <span className="admin-add-icon">
              {nativeMenuEnabled ? <UtensilsCrossed className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
            </span>
            <span>
              <span className="block font-semibold">Menu</span>
              <span className="block text-xs opacity-70">{nativeMenuEnabled ? tr("Native menu card", "Card menu nativa") : tr("Starter feature", "Funzione Starter")}</span>
            </span>
          </Button>
            <Button onClick={addNewCta} variant="outline" className="admin-add-card">
              <span className="admin-add-icon">
                <MousePointerClick className="h-4 w-4" />
              </span>
              <span>
                <span className="block font-semibold">CTA</span>
                <span className="block text-xs opacity-70">{tr("Smart action", "Azione intelligente")}</span>
              </span>
            </Button>
          <Button onClick={addNewHeading} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Type className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{tr("Heading", "Titolo")}</span>
              <span className="block text-xs opacity-70">{tr("Section title", "Titolo sezione")}</span>
            </span>
          </Button>
          <Button onClick={addNewImage} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Image className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{tr("Image", "Immagine")}</span>
              <span className="block text-xs opacity-70">{tr("Photo block", "Blocco immagine")}</span>
            </span>
          </Button>
          <Button
            onClick={addNewVideo}
            variant="outline"
            className="admin-add-card"
            aria-disabled={!videoUploadsEnabled}
            title={!videoUploadsEnabled ? tr("Video blocks require Pro", "I blocchi video richiedono Pro") : tr("Upload an MP4 or WebM video", "Carica un video MP4 o WebM")}
          >
            <span className="admin-add-icon">
              {videoUploadsEnabled ? <Film className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
            </span>
            <span>
              <span className="block font-semibold">Video</span>
              <span className="block text-xs opacity-70">{videoUploadsEnabled ? "MP4 / WebM" : tr("Pro feature", "Funzione Pro")}</span>
            </span>
          </Button>
          <Button onClick={addNewContact} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <UserCircle2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{tr("Contact", "Contatto")}</span>
              <span className="block text-xs opacity-70">{tr("Contact details", "Dettagli di contatto")}</span>
            </span>
          </Button>
          <Button onClick={addNewSocialRow} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Share2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{tr("Compact links", "Link compatti")}</span>
              <span className="block text-xs opacity-70">{tr("Pages and social icons", "Pagine e icone social")}</span>
            </span>
          </Button>
          <Button onClick={addNewCallout} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Tag className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Callout</span>
              <span className="block text-xs opacity-70">{tr("Promo block", "Blocco promozionale")}</span>
            </span>
          </Button>
          <Button onClick={addNewMap} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <MapPin className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{tr("Map", "Mappa")}</span>
              <span className="block text-xs opacity-70">{tr("Location block", "Blocco posizione")}</span>
            </span>
          </Button>
          <Button onClick={addNewEvent} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <CalendarClock className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{tr("Event", "Evento")}</span>
              <span className="block text-xs opacity-70">{tr("Calendar row", "Riga calendario")}</span>
            </span>
          </Button>
          <Button onClick={addNewEmbed} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Code2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Embed</span>
              <span className="block text-xs opacity-70">{tr("Video, music, booking...", "Video, musica, prenotazioni...")}</span>
            </span>
          </Button>
          <Button onClick={addNewBulletedList} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <List className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{tr("List", "Elenco")}</span>
              <span className="block text-xs opacity-70">{tr("Grouped items", "Elementi raggruppati")}</span>
            </span>
          </Button>
          <Button onClick={addNewTextCard} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Type className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{tr("Text", "Testo")}</span>
              <span className="block text-xs opacity-70">{tr("Freeform copy", "Testo libero")}</span>
            </span>
          </Button>
          <Button onClick={addNewSeparator} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Minus className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{tr("Separator", "Separatore")}</span>
              <span className="block text-xs opacity-70">{tr("Section label", "Etichetta sezione")}</span>
            </span>
          </Button>
            </div>
          </section>
        </>
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
