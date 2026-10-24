import { lazy, Suspense, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import type { LinkData } from "./LinkCard";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useAppI18n } from "@/lib/i18n";
import { RASTER_IMAGE_ACCEPT } from "@/lib/media-validation";
import { resolvePublicImageUrl } from "@/lib/public-asset-readiness";

const EmojiPicker = lazy(() => import("emoji-picker-react"));
const italianEmojis = () => import("emoji-picker-react/data/emojis-it");
const presets = [
  ["link", "Link", "Link"], ["globe", "Website", "Sito"], ["mail", "Email", "Email"],
  ["phone", "Phone", "Telefono"], ["map-pin", "Location", "Luogo"], ["calendar", "Calendar", "Calendario"],
  ["clock", "Time", "Orario"], ["shopping-bag", "Shop", "Negozio"], ["utensils", "Menu", "Menu"],
  ["coffee", "Coffee", "Caffè"], ["file-text", "Document", "Documento"], ["download", "Download", "Download"],
  ["image", "Photo", "Foto"], ["video", "Video", "Video"], ["music", "Music", "Musica"],
  ["headphones", "Audio", "Audio"], ["camera", "Camera", "Fotocamera"], ["briefcase", "Work", "Lavoro"],
  ["graduation-cap", "Learning", "Formazione"], ["heart", "Heart", "Cuore"], ["star", "Star", "Stella"],
  ["gift", "Gift", "Regalo"], ["message-circle", "Message", "Messaggio"], ["sparkles", "Highlights", "Novità"],
] as const;

type IconValue = Pick<LinkData, "icon" | "iconType">;

export function BlockIconPicker({ value, onChange, onUpload, disabled = false }: {
  value: IconValue;
  onChange: (value: IconValue) => void;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}) {
  const { tr, locale } = useAppI18n();
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState(!value.icon || value.icon.startsWith("/block-icons/") ? "preset"
    : value.iconType === "emoji" || value.icon.includes("emoji-datasource-google/") ? "emoji" : "upload");
  const image = value.iconType === "image" || value.iconType === "svg" ? resolvePublicImageUrl(value.icon) : null;

  return <div className="admin-block-icon-picker">
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{tr("Icon", "Icona")}</span>
      {value.icon && <div className="flex items-center gap-2">
        {image ? <img src={image} alt={tr("Selected icon", "Icona selezionata")} className="h-9 w-9 object-contain" /> : <span className="text-2xl">{value.icon}</span>}
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={tr("Remove icon", "Rimuovi icona")} onClick={() => onChange({ icon: undefined, iconType: undefined })}><X className="h-4 w-4" /></Button>
      </div>}
    </div>
    <Tabs value={mode} onValueChange={setMode}>
      <TabsList className="admin-icon-tabs" aria-label={tr("Icon source", "Tipo di icona")}>
        <TabsTrigger value="preset" disabled={disabled}>{tr("Icon", "Icone")}</TabsTrigger>
        <TabsTrigger value="emoji" disabled={disabled}>Emoji</TabsTrigger>
        <TabsTrigger value="upload" disabled={disabled}>{tr("Upload custom", "Carica immagine")}</TabsTrigger>
      </TabsList>
      <TabsContent value="preset">
        <div className="admin-icon-presets" role="group" aria-label={tr("Preset icons", "Icone predefinite")}>
          {presets.map(([name, english, italian]) => <button key={name} type="button" disabled={disabled}
            aria-label={tr(english, italian)} title={tr(english, italian)} aria-pressed={value.icon === `/block-icons/${name}.svg`}
            onClick={() => onChange({ icon: `/block-icons/${name}.svg`, iconType: "svg" })}>
            <img src={resolvePublicImageUrl(`/block-icons/${name}.svg`)!} alt="" width={28} height={28} />
          </button>)}
        </div>
      </TabsContent>
      <TabsContent value="emoji">
        <p className="mb-2 text-xs text-muted-foreground">Google Emoji</p>
        <Suspense fallback={<p role="status">{tr("Loading emojis…", "Caricamento emoji…")}</p>}>
          <EmojiPicker emojiStyle="google" theme="light" width="100%" height={350} lazyLoadEmojis autoFocusSearch={false}
            emojiData={locale === "it" ? italianEmojis : undefined} previewConfig={{ showPreview: false }}
            labels={{ searchPlaceholder: tr("Search emoji", "Cerca emoji"), searchLabel: tr("Search emoji", "Cerca emoji") }}
            onEmojiClick={emoji => { if (!disabled) onChange({ icon: emoji.imageUrl, iconType: "image" }); }} />
        </Suspense>
      </TabsContent>
      <TabsContent value="upload" className="space-y-2">
        <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
          {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {tr("Upload and optimize icon", "Carica e ottimizza icona")}
        </Button>
        <input ref={input} type="file" accept={RASTER_IMAGE_ACCEPT} aria-label={tr("Upload custom icon", "Carica icona personalizzata")} className="hidden" disabled={disabled}
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void onUpload(file); }} />
        <p className="text-xs text-muted-foreground">{tr("Up to 10 MB. Automatically resized to fit within 256 × 256 px, keeping proportions.", "Fino a 10 MB. Ridimensionamento automatico entro 256 × 256 px, mantenendo le proporzioni.")}</p>
      </TabsContent>
    </Tabs>
  </div>;
}
