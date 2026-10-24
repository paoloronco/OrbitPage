import { useRef, useState, type CSSProperties, type ComponentProps } from "react";
import { MousePointer2, Palette, UserRound, Layers3, SlidersHorizontal, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { ColorPicker } from "./ui/color-picker";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { LivePreview, type PreviewDevice } from "./LivePreview";
import { BackgroundMediaCustomizer } from "./BackgroundMediaCustomizer";
import { PublicProfileSection } from "./PublicProfileSection";
import { PublicBlockRenderer } from "./PublicBlockRenderer";
import type { LinkData } from "./LinkCard";
import type { PublicEditorTarget } from "./PublicView";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import { getPublicBlockAlignment, getPublicTextColor } from "@/lib/public-block-style";
import { getThemeCssVariables, getContentCardVariant, getContentCardVariantCssVariables, type ThemeConfig, type CardSurfaceEffect } from "@/lib/theme";
import { useAppI18n } from "@/lib/i18n";
import type { EditableTheme } from "./theme-save-state";

export type FineTuningProfile = ComponentProps<typeof LivePreview>["profile"];
export type LinkStylePatch = Pick<LinkData, "backgroundColor" | "textColor" | "surfaceEffect" | "titleFontFamily" | "descriptionFontFamily" | "titleFontSize" | "descriptionFontSize" | "alignment" | "size">;
const inheritedLinkStyle: LinkStylePatch = { backgroundColor: undefined, textColor: undefined, surfaceEffect: undefined, titleFontFamily: undefined, descriptionFontFamily: undefined, titleFontSize: undefined, descriptionFontSize: undefined, alignment: undefined, size: undefined };
type Target = "page" | "profile" | "cards" | "layout" | { id: string };

const fonts = [["Inter, system-ui, sans-serif", "Inter"], ["Poppins, system-ui, sans-serif", "Poppins"], ["Roboto, system-ui, sans-serif", "Roboto"], ["Montserrat, system-ui, sans-serif", "Montserrat"], ["Open Sans, system-ui, sans-serif", "Open Sans"], ["Lato, system-ui, sans-serif", "Lato"], ["Playfair Display, Georgia, serif", "Playfair Display"], ["Georgia, serif", "Georgia"]];

export function ThemeFineTuning({ theme, profile, links, device, onThemeChange, onProfileChange, onLinkChange, publicPageHref, showOrbitPageBadge, onSave, saving, dirty, error, onDialogChange, ...mediaProps }: {
  theme: EditableTheme;
  profile: FineTuningProfile;
  links: LinkData[];
  device: PreviewDevice;
  onThemeChange: (patch: Partial<EditableTheme>) => void;
  onProfileChange: (patch: Partial<ProfileAppearance>) => void;
  onLinkChange: (id: string, patch: LinkStylePatch) => void;
  publicPageHref?: string;
  showOrbitPageBadge?: boolean;
  onSave: () => Promise<boolean>;
  saving: boolean;
  dirty: boolean;
  error: string;
  onDialogChange: (open: boolean) => void;
} & Pick<ComponentProps<typeof BackgroundMediaCustomizer>, "videoUploadsEnabled" | "maxUploadBytes" | "maxVideoUploadBytes" | "managePlanHref">) {
  const { tr } = useAppI18n();
  const [target, setTarget] = useState<Target | null>(null);
  const [shared, setShared] = useState(false);
  const [openedFingerprint, setOpenedFingerprint] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const fingerprint = JSON.stringify([theme, profile.appearance, links]);
  const open = (next: Target) => { opener.current = document.activeElement as HTMLElement; setTarget(next); setShared(false); setOpenedFingerprint(fingerprint); onDialogChange(true); };
  const close = () => { if (!saving) { setTarget(null); onDialogChange(false); } };
  const select = (selection: PublicEditorTarget) => open(selection.kind === "profile" ? "profile" : { id: selection.id });
  const selectedLink = typeof target === "object" && target ? links.find(link => link.id === target.id) : undefined;
  const single = Boolean(selectedLink && !shared);
  const cards = target === "cards" || Boolean(selectedLink && shared);
  const appearance = profile.appearance || {};
  const variant = selectedLink ? getContentCardVariant(theme, links.indexOf(selectedLink)) : theme.contentCard;
  const title = selectedLink ? selectedLink.title || tr("Content card", "Card contenuto") : target === "profile" ? tr("Profile", "Profilo") : target === "cards" ? tr("Shared card style", "Stile condiviso delle card") : target === "layout" ? tr("Page layout", "Layout pagina") : tr("Page background", "Sfondo pagina");
  const color = (label: string, value: string, change: (value: string) => void) => <div className="theme-fine-field"><Label>{label}</Label><ColorPicker label={label} value={value} onChange={change} disabled={saving} /></div>;
  const choice = (label: string, value: string, values: string[][], change: (value: string) => void) => <div className="theme-fine-field"><Label>{label}</Label><Select value={value} onValueChange={change} disabled={saving}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent className="admin-content-select theme-fine-select">{values.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select></div>;
  const font = (label: string, value: string | undefined, change: (value: string) => void, inherit = true) => choice(label, value || "inherit", [...(inherit ? [["inherit", tr("Use page font", "Usa font pagina")]] : []), ...fonts], change);
  const range = (label: string, value: number, min: number, max: number, change: (value: number) => void, unit = "px", step = 1) => <div className="theme-fine-field"><Label>{label}<span>{unit === "%" ? Math.round(value * 100) : value}{unit}</span></Label><Slider disabled={saving} aria-label={label} value={[value]} min={min} max={max} step={step} onValueChange={([next]) => change(next)} /></div>;
  const effects = [["solid", tr("Solid", "Solida")], ["transparent", tr("Transparent", "Trasparente")], ["liquid-glass", "Liquid glass"]];
  const directions = [["0deg", tr("Vertical", "Verticale")], ["90deg", tr("Horizontal", "Orizzontale")], ["135deg", tr("Diagonal", "Diagonale")], ["45deg", tr("Reverse diagonal", "Diagonale inversa")], ["180deg", tr("Reverse vertical", "Verticale inversa")], ["270deg", tr("Reverse horizontal", "Orizzontale inversa")]];
  const patchCard = (patch: Partial<ThemeConfig["contentCard"]>) => onThemeChange({ contentCard: { ...theme.contentCard, ...patch } });
  const patchShadow = (patch: Partial<ThemeConfig["cardShadow"]>) => onThemeChange({ cardShadow: { ...theme.cardShadow, ...patch } });
  const previewStyle = { ...getThemeCssVariables(theme), background: theme.backgroundMedia.type === "color" ? theme.background : `linear-gradient(${theme.backgroundGradient.direction}, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`, fontFamily: theme.fontFamily } as CSSProperties;

  return <div className="theme-fine-workspace">
    <aside className="theme-fine-guide">
      <span className="theme-fine-eyebrow"><MousePointer2 size={16} /> {tr("Design on your page", "Disegna sulla tua pagina")}</span>
      <h3>{tr("Choose what to personalize", "Scegli cosa personalizzare")}</h3>
      <p>{tr("Click a card or your profile in the preview. Only the controls for that element will open.", "Clicca una card o il profilo nell’anteprima. Si aprono solo i controlli per quell’elemento.")}</p>
      <div className="theme-fine-targets">
        {([ ["page", Palette, tr("Page background", "Sfondo pagina"), tr("Color, gradient, image or video", "Colore, gradiente, immagine o video")], ["profile", UserRound, tr("Profile", "Profilo"), tr("Surface, text and photo", "Superficie, testo e foto")], ["cards", Layers3, tr("Shared card style", "Stile condiviso delle card"), tr("The starting style for your cards", "Lo stile di partenza delle tue card")], ["layout", SlidersHorizontal, tr("Page layout", "Layout pagina"), tr("Spacing, shape and typography", "Spaziature, forme e caratteri")] ] as const).map(([id, Icon, label, detail]) => <button key={id} type="button" onClick={() => open(id)} disabled={saving}><Icon size={20} /><span><strong>{label}</strong><small>{detail}</small></span><ArrowRight size={16} /></button>)}
      </div>
      <p className="theme-fine-hint">{tr("Changes stay in your draft until you save.", "Le modifiche restano in bozza fino al salvataggio.")}</p>
    </aside>
    <section className="theme-fine-page-preview" aria-label={tr("Interactive theme preview", "Anteprima tema interattiva")}>
      <header><span><MousePointer2 size={16} />{tr("Click an element to edit it", "Clicca un elemento per modificarlo")}</span></header>
      <div onClick={event => { if (!saving && (event.target as HTMLElement).closest('.admin-live-preview__page') && !(event.target as HTMLElement).closest('[data-public-editor-target]')) { event.preventDefault(); open("page"); } }}>
        <LivePreview profile={profile} links={links} theme={theme} device={device} publicPageHref={publicPageHref} showOrbitPageBadge={showOrbitPageBadge} onEditorSelect={saving ? undefined : select} />
      </div>
    </section>
    <Dialog open={target !== null} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="orbitpage-admin theme-fine-dialog translate-x-0 translate-y-0" overlayClassName="theme-fine-overlay" dirty={saving || fingerprint !== openedFingerprint} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }} onEscapeKeyDown={event => { if (saving || document.querySelector('.orbit-color-picker__popover')) event.preventDefault(); }}>
        <header className="theme-fine-dialog-heading"><span className="theme-fine-eyebrow">{tr("Fine tuning", "Fine-tuning")}</span><DialogTitle>{title}</DialogTitle><DialogDescription>{tr("See each change immediately. Save when you are ready.", "Vedi subito ogni modifica. Salva quando sei pronto.")}</DialogDescription></header>
        <div className="theme-fine-dialog-body">
          <fieldset className="theme-fine-controls" disabled={saving}>
            {selectedLink && <><div className="theme-fine-scope" role="group" aria-label={tr("Apply changes to", "Applica modifiche a")}><button type="button" aria-pressed={!shared} onClick={() => setShared(false)}>{tr("This card", "Questa card")}</button><button type="button" aria-pressed={shared} onClick={() => setShared(true)}>{tr("Shared style", "Stile condiviso")}</button></div><p className="theme-fine-hint">{single ? tr("Only this card changes.", "Cambia solo questa card.") : tr("Applies to all cards using the shared style. Individual overrides are kept.", "Vale per tutte le card che usano lo stile condiviso. Le personalizzazioni singole restano attive.")}</p></>}
            {single && selectedLink && <>
              {color(tr("Card background", "Sfondo card"), selectedLink.backgroundColor || variant.background, backgroundColor => onLinkChange(selectedLink.id, { backgroundColor }))}
              {color(tr("Card text", "Testo card"), getPublicTextColor(selectedLink) || variant.foreground, textColor => onLinkChange(selectedLink.id, { textColor }))}
              {choice(tr("Surface", "Superficie"), selectedLink.surfaceEffect || "inherit", [["inherit", tr("Use shared style", "Usa stile condiviso")], ...effects], surfaceEffect => onLinkChange(selectedLink.id, { surfaceEffect: surfaceEffect as LinkData["surfaceEffect"] }))}
              <details><summary>{tr("Typography & size", "Caratteri e dimensioni")}</summary><div>
                {font(tr("Title font", "Font titolo"), selectedLink.titleFontFamily, titleFontFamily => onLinkChange(selectedLink.id, { titleFontFamily: titleFontFamily === "inherit" ? undefined : titleFontFamily }))}
                {font(tr("Description font", "Font descrizione"), selectedLink.descriptionFontFamily, descriptionFontFamily => onLinkChange(selectedLink.id, { descriptionFontFamily: descriptionFontFamily === "inherit" ? undefined : descriptionFontFamily }))}
                {range(tr("Title size", "Dimensione titolo"), parseInt(selectedLink.titleFontSize || "16"), 10, 48, value => onLinkChange(selectedLink.id, { titleFontSize: `${value}px` }))}
                {range(tr("Description size", "Dimensione descrizione"), parseInt(selectedLink.descriptionFontSize || "14"), 10, 36, value => onLinkChange(selectedLink.id, { descriptionFontSize: `${value}px` }))}
                {choice(tr("Alignment", "Allineamento"), getPublicBlockAlignment(selectedLink), [["left", tr("Left", "Sinistra")], ["center", tr("Center", "Centro")], ["right", tr("Right", "Destra")]], alignment => onLinkChange(selectedLink.id, { alignment: alignment as LinkData["alignment"] }))}
                {choice(tr("Card size", "Dimensione card"), selectedLink.size || "medium", [["small", tr("Small", "Piccola")], ["medium", tr("Medium", "Media")], ["large", tr("Large", "Grande")]], size => onLinkChange(selectedLink.id, { size: size as LinkData["size"] }))}
              </div></details>
              <Button variant="outline" onClick={() => onLinkChange(selectedLink.id, inheritedLinkStyle)}>{tr("Reset to shared style", "Ripristina stile condiviso")}</Button>
            </>}
            {cards && <>
              {color(tr("Card background", "Sfondo card"), theme.contentCard.background, background => patchCard({ background, backgroundSecondary: background }))}
              {color(tr("Main card text", "Testo principale card"), theme.contentCard.foreground, foreground => patchCard({ foreground }))}
              {color(tr("Secondary card text", "Testo secondario card"), theme.contentCard.muted, muted => patchCard({ muted }))}
              {choice(tr("Surface", "Superficie"), theme.contentCardEffect, effects, contentCardEffect => onThemeChange({ contentCardEffect: contentCardEffect as CardSurfaceEffect }))}
              {range(tr("Surface opacity", "Opacità superficie"), theme.contentCardOpacity, 0, 1, contentCardOpacity => onThemeChange({ contentCardOpacity }), "%", .01)}
              <details><summary>{tr("Gradient & accents", "Gradiente e accenti")}</summary><div>
                {color(tr("Gradient end", "Fine gradiente"), theme.contentCard.backgroundSecondary, backgroundSecondary => patchCard({ backgroundSecondary }))}
                {choice(tr("Gradient direction", "Direzione gradiente"), theme.contentCard.direction, directions, direction => patchCard({ direction }))}
                {color(tr("Card border", "Bordo card"), theme.contentCard.border, border => patchCard({ border }))}
                {color(tr("Icons & buttons", "Icone e pulsanti"), theme.contentCard.accent, accent => patchCard({ accent }))}
                {color(tr("Button text", "Testo pulsanti"), theme.contentCard.accentForeground, accentForeground => patchCard({ accentForeground }))}
                {color(tr("Glass tint", "Tinta vetro"), theme.cardBlurTint || theme.card, cardBlurTint => onThemeChange({ cardBlurTint }))}
              </div></details>
              <details><summary>{tr("Typography", "Caratteri")}</summary><div>
                {font(tr("Card titles", "Titoli card"), theme.cardTitleFontFamily, cardTitleFontFamily => onThemeChange({ cardTitleFontFamily }))}
                {font(tr("Card descriptions", "Descrizioni card"), theme.cardDescriptionFontFamily, cardDescriptionFontFamily => onThemeChange({ cardDescriptionFontFamily }))}
                {font("URL", theme.urlFontFamily, urlFontFamily => onThemeChange({ urlFontFamily }))}
              </div></details>
              {links.some(link => (Object.keys(inheritedLinkStyle) as (keyof LinkStylePatch)[]).some(key => link[key] !== undefined && link[key] !== "inherit")) && <details><summary>{tr("Individual card overrides", "Personalizzazioni delle singole card")}</summary><div><p>{tr("Reset individual styles so every card uses this shared style.", "Ripristina le personalizzazioni per applicare questo stile condiviso a tutte le card.")}</p><Button variant="outline" onClick={() => links.forEach(link => onLinkChange(link.id, inheritedLinkStyle))}>{tr("Use shared style on every card", "Usa stile condiviso su tutte le card")}</Button></div></details>}
            </>}
            {target === "profile" && <>
              {color(tr("Profile background", "Sfondo profilo"), appearance.cardBackgroundColor || theme.profileCard.background, cardBackgroundColor => onProfileChange({ cardBackgroundColor, cardBackgroundImage: undefined }))}
              {color(tr("Profile text", "Testo profilo"), appearance.cardTextColor || theme.profileCard.foreground, cardTextColor => onProfileChange({ cardTextColor }))}
              {color(tr("Secondary profile text", "Testo secondario profilo"), appearance.cardMutedColor || theme.profileCard.muted, cardMutedColor => onProfileChange({ cardMutedColor }))}
              {choice(tr("Surface", "Superficie"), appearance.surfaceEffect || "inherit", [["inherit", tr("Use theme", "Usa tema")], ...effects], surfaceEffect => onProfileChange({ surfaceEffect: surfaceEffect as ProfileAppearance["surfaceEffect"] }))}
              {range(tr("Surface opacity", "Opacità superficie"), appearance.surfaceOpacity ?? theme.profileCardOpacity, 0, 1, surfaceOpacity => onProfileChange({ surfaceOpacity }), "%", .01)}
              <details><summary>{tr("Border & shape", "Bordo e forma")}</summary><div>
                {range(tr("Corner radius", "Arrotondamento"), appearance.cardRadius ?? theme.cardRadius, 0, 40, cardRadius => onProfileChange({ cardRadius }))}
                {color(tr("Profile border", "Bordo profilo"), appearance.cardBorderColor || theme.profileCard.border, cardBorderColor => onProfileChange({ cardBorderColor, cardBorderEnabled: true }))}
                {range(tr("Border width", "Spessore bordo"), appearance.cardBorderEnabled === false ? 0 : appearance.cardBorderWidth ?? 1, 0, 6, cardBorderWidth => onProfileChange({ cardBorderWidth, cardBorderEnabled: cardBorderWidth > 0 }))}
                {color(tr("Profile accents", "Accenti profilo"), appearance.accentColor || theme.profileCard.accent, accentColor => onProfileChange({ accentColor }))}
                {range(tr("Surface blur", "Sfocatura superficie"), appearance.surfaceBlur ?? Math.min(40, theme.blurIntensity), 0, 40, surfaceBlur => onProfileChange({ surfaceBlur }))}
                {color(tr("Shadow color", "Colore ombra"), appearance.cardShadowColor || theme.cardShadow.color, cardShadowColor => onProfileChange({ cardShadowColor }))}
                {range(tr("Shadow opacity", "Opacità ombra"), appearance.cardShadowOpacity ?? theme.cardShadow.opacity, 0, 1, cardShadowOpacity => onProfileChange({ cardShadowOpacity }), "%", .01)}
              </div></details>
              <details><summary>{tr("Typography & photo", "Caratteri e foto")}</summary><div>
                {font(tr("Profile name", "Nome profilo"), theme.profileNameFontFamily, profileNameFontFamily => onThemeChange({ profileNameFontFamily }))}
                {font(tr("Profile description", "Descrizione profilo"), theme.profileDescriptionFontFamily, profileDescriptionFontFamily => onThemeChange({ profileDescriptionFontFamily }))}
                {choice(tr("Photo shape", "Forma foto"), appearance.avatarShape || "round", [["round", tr("Round", "Rotonda")], ["rounded", tr("Rounded", "Arrotondata")], ["square", tr("Square", "Quadrata")]], avatarShape => onProfileChange({ avatarShape: avatarShape as ProfileAppearance["avatarShape"] }))}
                {range(tr("Photo size", "Dimensione foto"), appearance.avatarSize ?? 96, 56, 192, avatarSize => onProfileChange({ avatarSize }))}
                {color(tr("Photo border", "Bordo foto"), appearance.avatarBorderColor || theme.profileCard.border, avatarBorderColor => onProfileChange({ avatarBorderColor, avatarBorderEnabled: true }))}
              </div></details>
              <details><summary>{tr("Profile gradient", "Gradiente profilo")}</summary><div><p>{tr("The gradient replaces a custom solid background.", "Il gradiente sostituisce lo sfondo a tinta unita personalizzato.")}</p>
                {color(tr("Gradient start", "Inizio gradiente"), theme.profileCard.background, background => { onProfileChange({ cardBackgroundColor: undefined, cardBackgroundImage: undefined }); onThemeChange({ profileCard: { ...theme.profileCard, background } }); })}
                {color(tr("Gradient end", "Fine gradiente"), theme.profileCard.backgroundSecondary, backgroundSecondary => { onProfileChange({ cardBackgroundColor: undefined, cardBackgroundImage: undefined }); onThemeChange({ profileCard: { ...theme.profileCard, backgroundSecondary } }); })}
                {choice(tr("Gradient direction", "Direzione gradiente"), theme.profileCard.direction, directions, direction => { onProfileChange({ cardBackgroundColor: undefined, cardBackgroundImage: undefined }); onThemeChange({ profileCard: { ...theme.profileCard, direction } }); })}
              </div></details>
            </>}
            {target === "page" && <>
              <BackgroundMediaCustomizer config={theme.backgroundMedia} onChange={backgroundMedia => onThemeChange({ backgroundMedia })} {...mediaProps} />
              {theme.backgroundMedia.type === "color" ? color(tr("Page background", "Sfondo pagina"), theme.background, background => onThemeChange({ background })) : theme.backgroundMedia.type === "gradient" ? <>
                {color(tr("Gradient start", "Inizio gradiente"), theme.backgroundGradient.from, from => onThemeChange({ backgroundGradient: { ...theme.backgroundGradient, from } }))}
                {color(tr("Gradient end", "Fine gradiente"), theme.backgroundGradient.to, to => onThemeChange({ backgroundGradient: { ...theme.backgroundGradient, to } }))}
                {choice(tr("Gradient direction", "Direzione gradiente"), theme.backgroundGradient.direction, directions, direction => onThemeChange({ backgroundGradient: { ...theme.backgroundGradient, direction } }))}
              </> : null}
              <details><summary>{tr("Page colors & accents", "Colori e accenti della pagina")}</summary><div>
                {color(tr("Buttons & highlights", "Pulsanti ed elementi in evidenza"), theme.primary, primary => onThemeChange({ primary, accent: primary }))}
                {color(tr("Accent glow", "Bagliore accento"), theme.primaryGlow, primaryGlow => onThemeChange({ primaryGlow }))}
                {color(tr("Page text", "Testo pagina"), theme.foreground, foreground => onThemeChange({ foreground }))}
                {color(tr("Secondary page text", "Testo secondario pagina"), theme.muted, muted => onThemeChange({ muted }))}
                {color(tr("Secondary surfaces", "Superfici secondarie"), theme.backgroundSecondary, backgroundSecondary => onThemeChange({ backgroundSecondary }))}
                {color(tr("Page borders", "Bordi pagina"), theme.border, border => onThemeChange({ border }))}
              </div></details>
            </>}
            {target === "layout" && <>
              {range(tr("Card spacing", "Spaziatura card"), theme.cardSpacing, 4, 32, cardSpacing => onThemeChange({ cardSpacing }))}
              {range(tr("Card radius", "Arrotondamento card"), theme.cardRadius, 0, 28, cardRadius => onThemeChange({ cardRadius }))}
              {choice(tr("Page width", "Larghezza pagina"), theme.maxWidth, [["20rem", "320 px"], ["24rem", "384 px"], ["28rem", "448 px"], ["32rem", "512 px"], ["36rem", "576 px"]], maxWidth => onThemeChange({ maxWidth }))}
              {font(tr("Page font", "Font pagina"), theme.fontFamily, fontFamily => onThemeChange({ fontFamily }), false)}
              <details><summary>{tr("Typography details", "Dettagli tipografici")}</summary><div>{font(tr("Buttons", "Pulsanti"), theme.buttonFontFamily, buttonFontFamily => onThemeChange({ buttonFontFamily }))}{font(tr("Footer", "Footer"), theme.footerFontFamily, footerFontFamily => onThemeChange({ footerFontFamily }))}</div></details>
              <details><summary>{tr("Shadow & blur", "Ombra e sfocatura")}</summary><div>
                {range(tr("Surface blur", "Sfocatura superficie"), theme.blurIntensity, 0, 50, blurIntensity => onThemeChange({ blurIntensity }))}
                {color(tr("Shadow color", "Colore ombra"), theme.cardShadow.color, color => patchShadow({ color }))}
                {range(tr("Shadow opacity", "Opacità ombra"), theme.cardShadow.opacity, 0, 1, opacity => patchShadow({ opacity }), "%", .01)}
                {range(tr("Horizontal offset", "Spostamento orizzontale"), theme.cardShadow.offsetX, -32, 32, offsetX => patchShadow({ offsetX }))}
                {range(tr("Vertical offset", "Spostamento verticale"), theme.cardShadow.offsetY, -32, 48, offsetY => patchShadow({ offsetY }))}
                {range(tr("Shadow softness", "Sfocatura ombra"), theme.cardShadow.blur, 0, 96, blur => patchShadow({ blur }))}
                {range(tr("Shadow spread", "Estensione ombra"), theme.cardShadow.spread, -32, 48, spread => patchShadow({ spread }))}
              </div></details>
            </>}
          </fieldset>
          <aside className="theme-fine-element-preview"><p>{tr("Live preview", "Anteprima in tempo reale")}</p>
            {selectedLink || target === "profile" || target === "cards" ? <div className="theme-fine-element-canvas admin-live-preview" style={previewStyle}><div className="public-page-root public-page-root--preview-mobile" onClickCapture={event => event.preventDefault()} {...{ inert: "" }}>
              {target === "profile" ? <PublicProfileSection profile={profile} surfaceEffect={theme.profileCardEffect} layoutViewport="mobile" /> : (() => { const source = selectedLink || links[0]; const link = source && cards ? { ...source, ...inheritedLinkStyle } : source; return link ? <div className="content-card-variant-0" data-surface-effect={link.surfaceEffect && link.surfaceEffect !== "inherit" ? link.surfaceEffect : theme.contentCardEffect} style={getContentCardVariantCssVariables(theme, Math.max(0, links.findIndex(item => item.id === link.id))) as CSSProperties}><PublicBlockRenderer link={link} /></div> : <p>{tr("Add a card in Content to see it here.", "Aggiungi una card in Content per vederla qui.")}</p>; })()}
            </div></div> : <LivePreview profile={profile} links={links} theme={theme} device="mobile" publicPageHref={publicPageHref} showOrbitPageBadge={showOrbitPageBadge} />}
            <small>{tr("Your real content, with the current draft styles.", "I tuoi contenuti reali, con gli stili della bozza attuale.")}</small>
          </aside>
        </div>
        <footer className="theme-fine-dialog-footer"><span role={error ? "alert" : "status"}>{error || (dirty ? tr("Unsaved changes", "Modifiche non salvate") : tr("All changes saved", "Tutte le modifiche salvate"))}</span><Button variant="outline" disabled={saving} onClick={close}>{tr("Done", "Fatto")}</Button><Button disabled={!dirty || saving} onClick={async () => { if (await onSave()) { setTarget(null); onDialogChange(false); } }}>{saving ? tr("Saving…", "Salvataggio…") : tr("Save changes", "Salva modifiche")}</Button></footer>
      </DialogContent>
    </Dialog>
  </div>;
}
