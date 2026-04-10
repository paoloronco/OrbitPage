import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// removed large Textarea editor to keep the card compact
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Edit, Trash2, GripVertical, Upload, Type, ExternalLink, Plus, X, Eye, EyeOff } from "lucide-react";
import { LinkData } from "./LinkCard";

interface TextCardProps {
  link: LinkData;
  onUpdate: (link: LinkData) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const TextCard = ({ link, onUpdate, onDelete, isDragging, onMoveUp, onMoveDown }: TextCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLink, setEditLink] = useState(link);

  const handleSave = () => {
    onUpdate(editLink);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditLink(link);
    setIsEditing(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    return styles;
  };

  const handleClick = () => {
    if (!isEditing && link.url) {
      window.open(link.url, '_blank');
    }
  };

  const addTextItem = () => {
    setEditLink(prev => ({
      ...prev,
      textItems: [...(prev.textItems || []), { text: '', url: '', textColor: prev.textColor || '#000000', fontSize: prev.descriptionFontSize || '14px', fontFamily: prev.descriptionFontFamily || 'Inter, system-ui, sans-serif' } as any]
    }));
  };

  const updateTextItem = (index: number, field: 'text' | 'url', value: string) => {
    setEditLink(prev => ({
      ...prev,
      textItems: prev.textItems?.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ) || []
    }));
  };

  const removeTextItem = (index: number) => {
    setEditLink(prev => ({
      ...prev,
      textItems: prev.textItems?.filter((_, i) => i !== index) || []
    }));
  };

  const formatContent = (content?: string) => {
    if (!content) return null;
    
    // Convert simple markdown-like syntax to HTML
    let formatted = content
      // Convert bullet points
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Convert numbered lists
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Convert line breaks
      .replace(/\n/g, '<br/>');
    
    // Wrap consecutive list items in ul tags
    formatted = formatted.replace(/(<li>.*?<\/li>(\s*<br\/>)*)+/g, (match) => {
      const listItems = match.replace(/<br\/>/g, '');
      return `<ul class="list-disc list-inside space-y-1 ml-2">${listItems}</ul>`;
    });
    
    return formatted;
  };

  const isVisible = link.isActive !== false;

  return (
    <Card
      className={`glass-card ${getSizeClasses(link.size)} transition-smooth hover:glow-effect group relative ${
        isDragging ? 'opacity-50 rotate-2' : !isVisible ? 'opacity-40' : ''
      } ${link.url ? 'cursor-pointer' : ''} ${isEditing ? 'admin-edit' : ''}`}
      onClick={handleClick}
      style={getCustomStyles()}
    >
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-smooth cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      
      <div className="ml-6">
        {isEditing ? (
          <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
            <Input
              value={editLink.title}
              onChange={(e) => setEditLink(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Text card title"
              className="glass-card border-primary/20 bg-white text-black dark:bg-gray-800 dark:text-white"
            />
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
            
            {/* Clickable List Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Clickable List Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTextItem}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Item
                </Button>
              </div>
              {editLink.textItems?.map((item: any, index) => (
                <div key={index} className="bg-white/5 dark:bg-white/3 rounded-lg p-3 mb-3 border border-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={item.text}
                      onChange={(e) => updateTextItem(index, 'text', e.target.value)}
                      placeholder="List item text"
                      className="bg-white text-black dark:bg-gray-800 dark:text-white flex-1 rounded-md"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTextItem(index)}
                      className="w-8 h-8 text-destructive"
                      title="Remove item"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="mt-2">
                    <Input
                      value={item.url || ''}
                      onChange={(e) => updateTextItem(index, 'url', e.target.value)}
                      placeholder="https://example.com"
                      className="bg-white text-black dark:bg-gray-800 dark:text-white w-full rounded-md"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="color"
                      value={item.textColor || '#000000'}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditLink(prev => ({
                          ...prev,
                          textItems: prev.textItems?.map((it, i) => i === index ? { ...it, textColor: v } : it) || []
                        }));
                      }}
                      className="w-10 h-8 p-0 rounded-md"
                    />
                    <div className="w-20">
                      <Input
                        type="number"
                        value={parseInt(item.fontSize || '14', 10)}
                        onChange={(e) => {
                          const v = `${e.target.value}px`;
                          setEditLink(prev => ({
                            ...prev,
                            textItems: prev.textItems?.map((it, i) => i === index ? { ...it, fontSize: v } : it) || []
                          }));
                        }}
                        className="h-8 rounded-md"
                      />
                    </div>
                    <div className="flex-1">
                      <Select
                        value={item.fontFamily || 'Inter, system-ui, sans-serif'}
                        onValueChange={(value: string) => {
                          setEditLink(prev => ({
                            ...prev,
                            textItems: prev.textItems?.map((it, i) => i === index ? { ...it, fontFamily: value } : it) || []
                          }));
                        }}
                      >
                        <SelectTrigger className="h-8 w-full bg-white text-black rounded-md">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={"Inter, system-ui, sans-serif"}>Inter</SelectItem>
                          <SelectItem value={"Arial, Helvetica, sans-serif"}>Arial</SelectItem>
                          <SelectItem value={"Georgia, serif"}>Georgia</SelectItem>
                          <SelectItem value={"'Times New Roman', Times, serif"}>Times New Roman</SelectItem>
                          <SelectItem value={"'Courier New', Courier, monospace"}>Courier New</SelectItem>
                          <SelectItem value={"Verdana, Geneva, sans-serif"}>Verdana</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Removed large free-text editor to keep UI compact; use clickable list items instead */}
            <Input
              value={editLink.url}
              onChange={(e) => setEditLink(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com (optional - makes the entire card clickable)"
              className="glass-card border-primary/20"
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

            {/* Icon Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Icon</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={editLink.icon || ''}
                  onChange={(e) => setEditLink(prev => ({ ...prev, icon: e.target.value, iconType: 'emoji' }))}
                  placeholder="📝 or emoji"
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

            {/* Size Selection */}
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

            {/* Colors */}
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
              <div className="flex items-center gap-2 mb-2">
                {link.icon && (
                  <div className="flex-shrink-0">
                    {link.iconType === 'image' || link.iconType === 'svg' ? (
                      <img src={link.icon} alt="" className="w-5 h-5 object-cover rounded" />
                    ) : (
                      <span className="text-lg">{link.icon}</span>
                    )}
                  </div>
                )}
                <h3 className="font-semibold truncate" style={{ color: link.textColor }}>
                  {link.title || "Text Card"}
                </h3>
                {link.url && <ExternalLink className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-smooth" />}
                {!link.url && <Type className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-smooth" />}
              </div>
              {link.textItems && link.textItems.length > 0 && (
                <ul className="text-sm leading-relaxed space-y-2 mb-3" style={{ textAlign: link.alignment as any }}>
                  {link.textItems.map((item: any, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2 mt-1 text-lg" style={{ color: item.textColor || link.textColor }}>•</span>
                      <div className="flex-1 min-w-0">
                        {/* Name/label on its own line */}
                        <div className="break-words" style={{ color: item.textColor || link.textColor, fontSize: item.fontSize || undefined, fontFamily: item.fontFamily || link.descriptionFontFamily || undefined }}>{item.text}</div>
                        {/* Link on a second indented line, wrap and ellipsize if too long */}
                        {item.url && (
                          <a
                            onClick={(e) => { e.stopPropagation(); }}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-6 block truncate hover:underline hover:text-primary transition-colors text-left"
                            style={{ color: item.textColor || link.textColor }}
                            title={item.url}
                          >
                            {item.url}
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {/* Note: long free-text content rendering removed to improve layout */}
            </div>
            
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-smooth" onClick={(e) => e.stopPropagation()}>
              {onMoveUp && (
                <Button
                  onClick={() => onMoveUp?.()}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  title="Move up"
                >
                  ▲
                </Button>
              )}
              {onMoveDown && (
                <Button
                  onClick={() => onMoveDown?.()}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  title="Move down"
                >
                  ▼
                </Button>
              )}
              <Button
                onClick={() => onUpdate({ ...link, isActive: !isVisible })}
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                title={isVisible ? 'Hide card' : 'Show card'}
              >
                {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
              </Button>
              <Button
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="icon"
                className="w-8 h-8"
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                onClick={() => onDelete(link.id)}
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};