import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Link, List, Type, Upload, Download } from "lucide-react";
import { LinkCard, LinkData } from "./LinkCard";
import { TextCard } from "./TextCard";
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
        type: link.type as 'link' | 'text'
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
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
  <div className="flex gap-2 justify-center flex-wrap">
          <Button 
            onClick={addNewLink}
            variant="gradient"
            className="gap-2"
          >
            <Link className="w-4 h-4" />
            Add Link
          </Button>
          <Button 
            onClick={addNewBulletedList}
            variant="outline"
            className="gap-2"
          >
            <List className="w-4 h-4" />
            Add bulleted list
          </Button>
          <Button 
            onClick={addNewTextCard}
            variant="outline"
            className="gap-2"
          >
            <Type className="w-4 h-4" />
            Add Text Card
          </Button>
        </div>
  <div className="flex gap-2 justify-center flex-wrap">
          <Button onClick={handleSave} variant="default" className="gap-2" disabled={!isDirty || busy}>
            Save
          </Button>
          <Button onClick={exportLinks} variant="outline" className="gap-2" disabled={busy}>
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={handleImportFile} variant="outline" className="gap-2" disabled={busy}>
            <Upload className="w-4 h-4" /> Import
          </Button>
        </div>
      </div>

      {workingLinks.length === 0 ? (
        <Card className="glass-card p-8 text-center">
            <div className="space-y-4">
              <div className="text-4xl opacity-50">📝</div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">No content yet</h3>
                <p className="text-muted-foreground text-sm">
                  Add links or text cards to get started with your personal hub.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={addNewLink} variant="gradient">
                  <Link className="w-4 h-4 mr-2" />
                  Add Link
                </Button>
                <Button onClick={addNewBulletedList} variant="outline">
                  <List className="w-4 h-4 mr-2" />
                  Add bulleted list
                </Button>
                <Button onClick={addNewTextCard} variant="outline">
                  <Type className="w-4 h-4 mr-2" />
                  Add Text Card
                </Button>
              </div>
            </div>
        </Card>
      ) : (
        <div className="flex flex-col" style={{ gap: 'var(--card-spacing)' }}>
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
              className={dragOverId === link.id ? 'ring-2 ring-primary/40 rounded-lg' : ''}
            >
              {link.type === 'text' ? (
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