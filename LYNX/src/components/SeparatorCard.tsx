import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";
import { LinkData } from "./LinkCard";

interface SeparatorCardProps {
  link: LinkData;
  onUpdate: (link: LinkData) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const SeparatorCard = ({ link, onUpdate, onDelete, isDragging, onMoveUp, onMoveDown }: SeparatorCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(link.title);
  const isVisible = link.isActive !== false;

  const handleSave = () => {
    onUpdate({ ...link, title });
    setIsEditing(false);
  };

  return (
    <div className={`relative group flex items-center gap-2 py-2 ${isDragging ? 'opacity-50' : ''} ${!isVisible ? 'opacity-40' : ''}`}>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-smooth cursor-grab">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 ml-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-primary/20" />
        {isEditing ? (
          <Input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
            className="h-7 w-36 text-center text-xs font-semibold glass-card border-primary/20"
          />
        ) : (
          <span
            className="text-xs font-semibold uppercase tracking-widest text-muted-foreground cursor-text select-none px-2"
            onDoubleClick={() => setIsEditing(true)}
          >
            {link.title || 'Section'}
          </span>
        )}
        <div className="h-px flex-1 bg-primary/20" />
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-smooth flex gap-1">
        {onMoveUp && <Button onClick={onMoveUp} variant="ghost" size="icon" className="w-7 h-7">▲</Button>}
        {onMoveDown && <Button onClick={onMoveDown} variant="ghost" size="icon" className="w-7 h-7">▼</Button>}
        <Button onClick={() => onUpdate({ ...link, isActive: !isVisible })} variant="ghost" size="icon" className="w-7 h-7" title={isVisible ? 'Hide' : 'Show'}>
          {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
        </Button>
        <Button onClick={() => setIsEditing(true)} variant="ghost" size="icon" className="w-7 h-7"><Edit className="w-3 h-3" /></Button>
        <Button onClick={() => onDelete(link.id)} variant="ghost" size="icon" className="w-7 h-7 text-destructive"><Trash2 className="w-3 h-3" /></Button>
      </div>
    </div>
  );
};
