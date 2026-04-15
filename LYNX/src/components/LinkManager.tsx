import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Link, List, Minus, Plus, Save, Type, Upload } from "lucide-react";
import { LinkCard, LinkData } from "./LinkCard";
import { TextCard } from "./TextCard";
import { SeparatorCard } from "./SeparatorCard";
import { useToast } from "@/components/ui/use-toast";
import { linksApi } from "@/lib/api-client";

interface LinkManagerProps {
  links: LinkData[];
  // Called only when user clicks Save
  onLinksUpdate: (links: LinkData[]) => void;
}

export const LinkManager = ({ links, onLinksUpdate }: LinkManagerProps) => {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const touchDragRef = useRef<{ id: string; lastTarget: string | null } | null>(null);
  const { toast } = useToast();
  // Maintain a working copy to allow fluid drag reordering without spamming saves
  const [workingLinks, setWorkingLinks] = useState<LinkData[]>(links);
  const [isDirty, setIsDirty] = useState(false);

  // Keep working copy in sync when parent provides a new links array
  useEffect(() => {
    // Replace working copy only when the incoming prop reference changes
    setWorkingLinks(links);
    setIsDirty(false);
  }, [links]);

  const addNewLink = () => {
    const newLink: LinkData = {
      id: Date.now().toString(),
      title: "New link",
      description: "",
      url: "",
      type: "link",
    };
    const updated = [...workingLinks, newLink];
    setWorkingLinks(updated);
    setIsDirty(true);
  };

  const addNewTextCard = () => {
    const newTextCard: LinkData = {
      id: Date.now().toString(),
      title: "New text",
      description: "",
      url: "",
      type: "text",
      content: "",
    };
    const updated = [...workingLinks, newTextCard];
    setWorkingLinks(updated);
    setIsDirty(true);
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
    };
    const updated = [...workingLinks, newListCard];
    setWorkingLinks(updated);
    setIsDirty(true);
  };

  const addNewSeparator = () => {
    const newSeparator: LinkData = {
      id: Date.now().toString(),
      title: 'Section',
      description: '',
      url: '',
      type: 'separator',
      isActive: true,
    };
    const updated = [...workingLinks, newSeparator];
    setWorkingLinks(updated);
    setIsDirty(true);
  };

  const updateLink = (updatedLink: LinkData) => {
    const updatedLinks = workingLinks.map(link => 
      String(link.id) === String(updatedLink.id) ? updatedLink : link
    );
    setWorkingLinks(updatedLinks);
    setIsDirty(true);
  };

  const deleteLink = (id: string) => {
    const updatedLinks = workingLinks.filter(link => String(link.id) !== String(id));
    setWorkingLinks(updatedLinks);
    setIsDirty(true);
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
        type: link.type as 'link' | 'text' | 'separator'
      })));
      setIsDirty(false);
      
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
  };

  const handleSave = () => {
    if (!isDirty) return;
    onLinksUpdate(workingLinks);
    setIsDirty(false);
  };

  return (
    <div className="admin-link-manager">
      <div className="admin-link-toolbar">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">Content cards</h2>
            {isDirty && <span className="admin-dirty-badge">Unsaved changes</span>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {workingLinks.length === 0 ? "Start with a link, text block, list, or separator." : `${workingLinks.length} items in your public page order.`}
          </p>
        </div>

        <div className="admin-link-actions">
          <Button onClick={handleSave} className="admin-action admin-action-primary" disabled={!isDirty || busy}>
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button onClick={exportLinks} variant="outline" className="admin-action" disabled={busy}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleImportFile} variant="outline" className="admin-action" disabled={busy}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </div>
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
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={addNewLink} className="admin-action admin-action-primary">
                  <Link className="h-4 w-4" />
                  Add link
                </Button>
                <Button onClick={addNewBulletedList} variant="outline" className="admin-action">
                  <List className="h-4 w-4" />
                  Add list
                </Button>
              </div>
            </div>
        </Card>
      ) : (
        <div className="admin-link-list">
          {workingLinks.map((link) => (
            <div
              key={link.id}
              data-link-id={link.id}
              draggable
              onDragStart={(e) => handleDragStart(e, link.id)}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter(link.id)}
              onDrop={(e) => handleDrop(e, link.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, link.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={dragOverId === link.id ? 'rounded-lg ring-2 ring-blue-400/50' : ''}
            >
              {link.type === 'separator' ? (
                <SeparatorCard
                  link={link}
                  onUpdate={updateLink}
                  onDelete={deleteLink}
                  isDragging={draggedItem === link.id}
                  onMoveUp={() => moveByOffset(link.id, -1)}
                  onMoveDown={() => moveByOffset(link.id, 1)}
                />
              ) : link.type === 'text' ? (
                <TextCard
                  link={link}
                  onUpdate={updateLink}
                  onDelete={deleteLink}
                  isDragging={draggedItem === link.id}
                  onMoveUp={() => moveByOffset(link.id, -1)}
                  onMoveDown={() => moveByOffset(link.id, 1)}
                />
              ) : (
                <LinkCard
                  link={link}
                  onUpdate={updateLink}
                  onDelete={deleteLink}
                  onMoveUp={() => moveByOffset(link.id, -1)}
                  onMoveDown={() => moveByOffset(link.id, 1)}
                  isDragging={draggedItem === link.id}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
