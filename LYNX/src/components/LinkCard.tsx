import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Edit, Trash2, ExternalLink, GripVertical, Upload, Eye, EyeOff, Image, X } from "lucide-react";
import { LinkEditMode } from "@/lib/permissions";

export interface LinkData {
  id: string;
  title: string;
  description: string;
  url: string;
  icon?: string;
  iconType?: 'emoji' | 'image' | 'svg';
  backgroundColor?: string;
  textColor?: string;
  // Per-link typography (pixel strings, e.g. '16px')
  titleFontSize?: string;
  titleFontFamily?: string;
  descriptionFontSize?: string;
  descriptionFontFamily?: string;
  // Alignment for content inside the card: left | center | right
  alignment?: 'left' | 'center' | 'right';
  size?: 'small' | 'medium' | 'large';
  type?: 'link' | 'text' | 'separator';
  isActive?: boolean; // Visibility toggle (undefined treated as true)
  content?: string; // For text-only cards
  clickCount?: number;
  startDate?: string;
  endDate?: string;
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
}

export const LinkCard = ({ link, onUpdate, onDelete, isDragging, onMoveUp, onMoveDown, editMode = 'full' }: LinkCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLink, setEditLink] = useState(link);

  const isFullEdit = editMode === 'full';
  const canEditStyle = editMode === 'full' || editMode === 'style';
  const canEditImages = editMode === 'full' || editMode === 'images';
  const canEdit = editMode !== 'view';
  const canDelete = editMode === 'full';
  const canReorder = editMode === 'full';

  const handleSave = () => {
    onUpdate(editLink);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditLink(link);
    setIsEditing(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setEditLink(prev => ({
          ...prev,
          icon: result,
          iconType: file.type.startsWith('image/svg') ? 'svg' : 'image'
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditLink(prev => ({ ...prev, coverImage: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const getSizeClasses = (size?: string) => {
    switch (size) {
      case 'small': return 'p-3';
      case 'large': return 'p-6';
      default: return 'p-4';
    }
  };

  const getCustomStyles = () => {
    const styles: React.CSSProperties = {};
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
    if (!isEditing && link.url) {
      window.open(link.url, '_blank');
    }
  };

  const isVisible = link.isActive !== false;

  return (
    <Card
      className={`glass-card ${getSizeClasses(link.size)} transition-smooth hover:glow-effect group cursor-pointer relative ${
        isDragging ? 'opacity-50 rotate-2' : !isVisible ? 'opacity-40' : ''
      } ${isEditing ? 'admin-edit' : ''}`}
      onClick={handleClick}
      style={getCustomStyles()}
    >
      {canReorder && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-smooth cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      
      <div className={canReorder ? "ml-6" : ""}>
        {isEditing ? (
          <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
            {isFullEdit && (
              <Input
                value={editLink.title}
                onChange={(e) => setEditLink(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Link title"
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
            <div className="grid grid-cols-3 gap-2">
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
            {isFullEdit && (
              <>
            <Textarea
              value={editLink.description}
              onChange={(e) => setEditLink(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Link description"
              className="glass-card border-primary/20 bg-white text-black dark:bg-gray-800 dark:text-white resize-none"
              rows={2}
            />
            <Input
              value={editLink.url}
              onChange={(e) => setEditLink(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com"
              className="glass-card border-primary/20 bg-white text-black dark:bg-gray-800 dark:text-white"
            />

            {/* Link Scheduler */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Show from (optional)</Label>
                <Input
                  type="date"
                  value={editLink.startDate || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, startDate: e.target.value || undefined }))}
                  className="h-8 w-full glass-card border-primary/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hide after (optional)</Label>
                <Input
                  type="date"
                  value={editLink.endDate || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, endDate: e.target.value || undefined }))}
                  className="h-8 w-full glass-card border-primary/20"
                />
              </div>
            </div>
              </>
            )}

            {/* Icon Upload */}
            {canEditImages && (
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
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.svg"
                  onChange={handleIconUpload}
                  className="hidden"
                />
              </div>
            </div>
            )}

            {canEditImages && (
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
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <input
                  ref={coverImageInputRef}
                  type="file"
                  accept="image/*"
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
            </div>
            )}

            {canEditStyle && (
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
            )}

            {canEditStyle && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Background</Label>
                <Input
                  type="color"
                  value={editLink.backgroundColor || '#000000'}
                  onChange={(e) => setEditLink(prev => ({ ...prev, backgroundColor: e.target.value }))}
                  className="h-8 w-full"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Text Color</Label>
                <Input
                  type="color"
                  value={editLink.textColor || '#ffffff'}
                  onChange={(e) => setEditLink(prev => ({ ...prev, textColor: e.target.value }))}
                  className="h-8 w-full"
                />
              </div>
            </div>
            )}
            
            <div className="flex gap-2">
              <Button onClick={handleSave} variant="gradient" size="sm">
                Save
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
            <div className="flex items-start justify-between">
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
              {link.url && (
                <p
                  className="text-xs mt-1 truncate underline font-medium"
                  style={link.textColor ? { color: link.textColor } : undefined}
                >
                  {link.url}
                </p>
              )}
              {(link.startDate || link.endDate) && (
                <span className="text-xs text-muted-foreground">⏰ {link.startDate || '…'} → {link.endDate || '…'}</span>
              )}
            </div>
            
            {canEdit && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-smooth" onClick={(e) => e.stopPropagation()}>
              {canReorder && onMoveUp && (
                <Button
                  onClick={onMoveUp}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  title="Move up"
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
                >
                  {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                </Button>
              )}
              <Button
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="icon"
                className="w-8 h-8"
              >
                <Edit className="w-3 h-3" />
              </Button>
              {canDelete && (
                <Button
                  onClick={() => onDelete(link.id)}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-destructive hover:text-destructive"
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