import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarClock, Code2, Download, Image, Link, List, LockKeyhole, Minus, MapPin, MousePointerClick, Palette, Plus, Share2, Save, Tag, Type, Upload, UserCircle2 } from "lucide-react";
import { LinkCard, LinkData } from "./LinkCard";
import { TextCard } from "./TextCard";
import { useToast } from "@/components/ui/use-toast";
import { linksApi } from "@/lib/api-client";
import { LinkEditMode } from "@/lib/permissions";
import { commitWorkingLinks } from "./link-save-state";
import { type LinkBlockType, buildBlockContent } from "@/lib/link-blocks";
import { getContentCardVariantCssVariables, getThemeCssVariables, type ThemeConfig } from "@/lib/theme";

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
  managePlanHref?: string;
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
  managePlanHref = "/dashboard?section=billing",
}: LinkManagerProps) => {
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
  const publicPreviewStyle = (index: number) => ({
    ...getThemeCssVariables(theme),
    ...getContentCardVariantCssVariables(theme, index),
  }) as CSSProperties;
  const atBlockLimit = maxBlocks !== undefined && maxBlocks !== null && workingLinks.length >= maxBlocks;

  const appendBlock = (block: LinkData) => {
    if (atBlockLimit) {
      toast({
        title: `${planName || "Current plan"} block limit reached`,
        description: `This workspace can contain up to ${maxBlocks} blocks.`,
        variant: "destructive",
      });
      return;
    }
    setWorkingLinks((current) => [...current, block]);
    setIsDirty(true);
    setSaveError("");
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

  const addNewLink = () => {
    const newLink: LinkData = {
      id: Date.now().toString(),
      title: "New link",
      description: "",
      url: "",
      type: "link",
      status: "live",
    };
    appendBlock(newLink);
  };

  const addNewCta = () => {
    const newCta: LinkData = {
      id: Date.now().toString(),
      title: "Book now",
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
      title: "Social row",
      description: "",
      url: "",
      type: "social_row",
      content: buildBlockContent({
        items: [],
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
          {editMode === 'style' && <><Palette className="h-4 w-4 shrink-0" /><span>Style editor — you can edit card colors, fonts, and size.</span></>}
          {editMode === 'images' && <><Image className="h-4 w-4 shrink-0" /><span>Image editor — you can edit card icons and cover images.</span></>}
          {editMode === 'view' && <span>View-only — you do not have permission to edit links.</span>}
        </div>
      )}

      <div className="admin-link-toolbar" data-onboarding="links-toolbar">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">Content cards</h2>
            {isDirty && <span className="admin-dirty-badge">Unsaved changes</span>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {workingLinks.length === 0
              ? "Start with a block, then arrange your public page."
              : `${workingLinks.length}${maxBlocks !== undefined && maxBlocks !== null ? ` of ${maxBlocks}` : ""} blocks in your public page order.`}
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
              {isBlockLibraryOpen ? "Close library" : "Add block"}
            </Button>
          )}
          {!isViewOnly && (
            <Button onClick={handleSave} className="admin-action admin-action-primary" disabled={!isDirty || busy} data-onboarding="links-save">
              <Save className="h-4 w-4" />
              Save
            </Button>
          )}
          <Button onClick={exportLinks} variant="outline" size="icon" className="admin-action" disabled={busy} aria-label="Export links" title="Export links">
            <Download className="h-4 w-4" />
          </Button>
          {isFullEdit && (
            <Button onClick={handleImportFile} variant="outline" size="icon" className="admin-action" disabled={busy} aria-label="Import links" title="Import links">
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {atBlockLimit && (
        <div className="admin-inline-plan-lock mb-4">
          <LockKeyhole className="h-4 w-4" />
          <span>{planName || "Your plan"} includes up to {maxBlocks} blocks. Existing blocks remain editable.</span>
          <a href={managePlanHref} target="_top">View plans</a>
        </div>
      )}

      {isFullEdit && isBlockLibraryOpen && (
        <section id="admin-block-library" className="admin-block-library" data-onboarding="link-add-grid">
          <div className="mb-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">Block library</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-950">Add content</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Choose a block to append it to the public page.</p>
          </div>
          <div className="admin-add-grid">
          <Button onClick={addNewLink} className="admin-add-card">
            <span className="admin-add-icon">
              <Link className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Link</span>
              <span className="block text-xs opacity-70">URL card</span>
            </span>
          </Button>
            <Button onClick={addNewCta} variant="outline" className="admin-add-card">
              <span className="admin-add-icon">
                <MousePointerClick className="h-4 w-4" />
              </span>
              <span>
                <span className="block font-semibold">CTA</span>
                <span className="block text-xs opacity-70">Smart action</span>
              </span>
            </Button>
          <Button onClick={addNewHeading} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Type className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Heading</span>
              <span className="block text-xs opacity-70">Section title</span>
            </span>
          </Button>
          <Button onClick={addNewImage} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Image className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Image</span>
              <span className="block text-xs opacity-70">Photo block</span>
            </span>
          </Button>
          <Button onClick={addNewContact} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <UserCircle2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Contact</span>
              <span className="block text-xs opacity-70">Contact details</span>
            </span>
          </Button>
          <Button onClick={addNewSocialRow} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Share2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Social row</span>
              <span className="block text-xs opacity-70">Social links</span>
            </span>
          </Button>
          <Button onClick={addNewCallout} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Tag className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Callout</span>
              <span className="block text-xs opacity-70">Promo block</span>
            </span>
          </Button>
          <Button onClick={addNewMap} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <MapPin className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Map</span>
              <span className="block text-xs opacity-70">Location block</span>
            </span>
          </Button>
          <Button onClick={addNewEvent} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <CalendarClock className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Event</span>
              <span className="block text-xs opacity-70">Calendar row</span>
            </span>
          </Button>
          <Button onClick={addNewEmbed} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Code2 className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Embed</span>
              <span className="block text-xs opacity-70">Video, music, booking...</span>
            </span>
          </Button>
          <Button onClick={addNewBulletedList} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <List className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">List</span>
              <span className="block text-xs opacity-70">Grouped items</span>
            </span>
          </Button>
          <Button onClick={addNewTextCard} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Type className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Text</span>
              <span className="block text-xs opacity-70">Freeform copy</span>
            </span>
          </Button>
          <Button onClick={addNewSeparator} variant="outline" className="admin-add-card">
            <span className="admin-add-icon">
              <Minus className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">Separator</span>
              <span className="block text-xs opacity-70">Section label</span>
            </span>
          </Button>
          </div>
        </section>
      )}

      {workingLinks.length === 0 ? (
        <Card className="admin-empty-state">
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-slate-950">No content yet</h3>
                <p className="text-sm leading-6 text-slate-600">
                  Add a first card, then drag items into the order you want.
                </p>
              </div>
              {isFullEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={addNewLink} className="admin-action admin-action-primary" disabled={atBlockLimit}>
                    <Link className="h-4 w-4" />
                    Add link
                  </Button>
                  <Button onClick={addNewBulletedList} variant="outline" className="admin-action" disabled={atBlockLimit}>
                    <List className="h-4 w-4" />
                    Add list
                  </Button>
                  <Button onClick={addNewHeading} variant="outline" className="admin-action" disabled={atBlockLimit}>
                    <Type className="h-4 w-4" />
                    Add heading
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
                  schedulingEnabled={schedulingEnabled}
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
                  schedulingEnabled={schedulingEnabled}
                  managePlanHref={managePlanHref}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
