import { usePreviewDeviceSlot } from "@/lib/use-preview-device-slot";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parseOrbitPageMenu } from '@orbitpage/page-schema';
import {
  ArrowDown, ArrowUp, Check,
  ImagePlus, ListTree, Palette, Plus, RotateCcw, Save, Trash2,
  UtensilsCrossed, X,
} from '@/components/ui/material-icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { MenuView } from './MenuView';
import { PreviewDeviceFrame } from './LivePreview';
import { Download, UploadCloud } from 'lucide-react';
import { PreviewDeviceToggle, type PreviewDevice } from './PreviewDeviceToggle';
import { ColorPicker } from '@/components/ui/color-picker';
import { OrbitLoader } from '@/components/ui/orbit-loader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { optimizeImageForUpload } from '@/lib/image-upload';
import { RASTER_IMAGE_ACCEPT } from '@/lib/media-validation';
import { uploadApi } from '@/lib/api-client';
import {
  MENU_THEME_PRESETS, formatMenuPriceInput, normalizeMenuCatalog, parseMenuPriceInput, menuStarterSections, needsMenuOnboarding,
  type MenuCatalog, type MenuItem, type MenuSection, type MenuThemePreset, type MenuVenueType,
} from '@/lib/menu';
import { useAppI18n } from '@/lib/i18n';
import { moveMenuSection, orderedSectionTree, reorderMenuItems, sectionSiblings } from './menu-editor-order';

interface MenuEditorProps {
  menu: MenuCatalog;
  enabled: boolean;
  maxItems: number | null;
  advancedTheme: boolean;
  showOrbitPageBadge?: boolean;
  brandingEditable?: boolean;
  onSave: (menu: MenuCatalog, showOrbitPageBadge?: boolean) => Promise<void>;
  selectedPanel?: MenuEditorPanel;
  onPanelChange?: (panel: MenuEditorPanel) => void;
}

type MenuEditorPanel = 'content' | 'appearance';
type SavedMenuNotice = { id: number; previousMenu: MenuCatalog; previousBadge: boolean };

const MENU_SAVE_NOTICE_DURATION_MS = 10_000;

const MENU_LOCALE_OPTIONS = [
  { value: 'en-GB', label: 'English (United Kingdom)', labelIt: 'Inglese (Regno Unito)' },
  { value: 'en-US', label: 'English (United States)', labelIt: 'Inglese (Stati Uniti)' },
  { value: 'it-IT', label: 'Italian (Italy)', labelIt: 'Italiano (Italia)' },
  { value: 'es-ES', label: 'Spanish (Spain)', labelIt: 'Spagnolo (Spagna)' },
  { value: 'es-MX', label: 'Spanish (Mexico)', labelIt: 'Spagnolo (Messico)' },
  { value: 'fr-FR', label: 'French (France)', labelIt: 'Francese (Francia)' },
  { value: 'fr-CA', label: 'French (Canada)', labelIt: 'Francese (Canada)' },
  { value: 'de-DE', label: 'German (Germany)', labelIt: 'Tedesco (Germania)' },
  { value: 'de-CH', label: 'German (Switzerland)', labelIt: 'Tedesco (Svizzera)' },
  { value: 'pt-PT', label: 'Portuguese (Portugal)', labelIt: 'Portoghese (Portogallo)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)', labelIt: 'Portoghese (Brasile)' },
  { value: 'nl-NL', label: 'Dutch (Netherlands)', labelIt: 'Olandese (Paesi Bassi)' },
  { value: 'pl-PL', label: 'Polish (Poland)', labelIt: 'Polacco (Polonia)' },
  { value: 'tr-TR', label: 'Turkish (Türkiye)', labelIt: 'Turco (Turchia)' },
  { value: 'ru-RU', label: 'Russian (Russia)', labelIt: 'Russo (Russia)' },
  { value: 'ar-SA', label: 'Arabic (Saudi Arabia)', labelIt: 'Arabo (Arabia Saudita)' },
  { value: 'zh-CN', label: 'Chinese (China)', labelIt: 'Cinese (Cina)' },
  { value: 'ja-JP', label: 'Japanese (Japan)', labelIt: 'Giapponese (Giappone)' },
  { value: 'ko-KR', label: 'Korean (South Korea)', labelIt: 'Coreano (Corea del Sud)' },
] as const;

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function menuFingerprint(menu: MenuCatalog) {
  return JSON.stringify({ ...menu, updatedAt: undefined });
}

function TagsInput({
  value, onChange, placeholder, label,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  label: string;
}) {
  const [inputValue, setInputValue] = useState(() => value.join(', '));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setInputValue(value.join(', '));
  }, [value]);

  const parseTags = (rawValue: string) => (
    [...new Set(rawValue.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 20)
  );

  return (
    <Input
      aria-label={label}
      value={inputValue}
      placeholder={placeholder}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => {
        setInputValue(event.target.value);
        onChange(parseTags(event.target.value));
      }}
      onBlur={(event) => {
        focused.current = false;
        const tags = parseTags(event.target.value);
        setInputValue(tags.join(', '));
        onChange(tags);
      }}
    />
  );
}

function PriceInput({
  value, locale, label, onChange,
}: {
  value: number;
  locale: string;
  label: string;
  onChange: (priceMinor: number) => void;
}) {
  const [inputValue, setInputValue] = useState(() => formatMenuPriceInput(value, locale));
  const focused = useRef(false);
  const parsedValue = parseMenuPriceInput(inputValue);

  useEffect(() => {
    if (!focused.current) setInputValue(formatMenuPriceInput(value, locale));
  }, [locale, value]);

  const commit = () => {
    focused.current = false;
    const priceMinor = parseMenuPriceInput(inputValue);
    if (priceMinor === null) {
      setInputValue(formatMenuPriceInput(value, locale));
      return;
    }
    onChange(priceMinor);
    setInputValue(formatMenuPriceInput(priceMinor, locale));
  };

  return (
    <Input
      aria-label={label}
      aria-invalid={inputValue !== '' && parsedValue === null}
      inputMode="decimal"
      type="text"
      value={inputValue}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setInputValue(nextValue);
        const priceMinor = parseMenuPriceInput(nextValue);
        if (priceMinor !== null) onChange(priceMinor);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setInputValue(formatMenuPriceInput(value, locale));
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function MenuEditor({
  menu, enabled, maxItems, advancedTheme,
  onSave, selectedPanel, onPanelChange, showOrbitPageBadge = true, brandingEditable = false,
}: MenuEditorProps) {
  const { tr, locale } = useAppI18n();
  const [onboardingStep, setOnboardingStep] = useState<number | null>(() => needsMenuOnboarding(normalizeMenuCatalog(menu)) ? 0 : null);
  const [seededFor, setSeededFor] = useState('');
  const [draft, setDraft] = useState(() => {
    const normalized = normalizeMenuCatalog(menu, maxItems ?? 250);
    return needsMenuOnboarding(normalized) ? { ...normalized, name: '', locale: MENU_LOCALE_OPTIONS.find(option => option.value.startsWith(`${locale}-`))?.value || 'en-GB' } : normalized;
  });
  const setupHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (onboardingStep !== null) setupHeading.current?.focus(); }, [onboardingStep]);
  const [device, setDevice] = useState<PreviewDevice>('mobile');
  const deviceSlot = usePreviewDeviceSlot('[data-orbitpage-menu-preview-device-slot]');
  const [dialog, setDialog] = useState<'identity' | 'footer' | 'category' | 'item' | null>(null);
  const dialogSnapshot = useRef<MenuCatalog | null>(null);
  const dialogBadgeSnapshot = useRef(showOrbitPageBadge);
  const [draftBadge, setDraftBadge] = useState(showOrbitPageBadge);
  useEffect(() => setDraftBadge(showOrbitPageBadge), [showOrbitPageBadge]);
  const [saving, setSaving] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [savedNotice, setSavedNotice] = useState<SavedMenuNotice | null>(null);
  const [localPanel, setLocalPanel] = useState<MenuEditorPanel>('content');
  const activePanel = selectedPanel ?? localPanel;
  const setActivePanel = (panel: MenuEditorPanel) => { setLocalPanel(panel); onPanelChange?.(panel); };
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => normalizeMenuCatalog(menu, maxItems ?? 250).items[0]?.id || null,
  );
  const savedNoticeTimerRef = useRef<number | null>(null);
  const persistedMenu = useMemo(() => normalizeMenuCatalog(menu, maxItems ?? 250), [maxItems, menu]);
  const isDirty = useMemo(() => menuFingerprint(draft) !== menuFingerprint(persistedMenu) || draftBadge !== showOrbitPageBadge, [draft, persistedMenu, draftBadge, showOrbitPageBadge]);
  const popupDirty = Boolean(dialogSnapshot.current && (menuFingerprint(draft) !== menuFingerprint(dialogSnapshot.current) || draftBadge !== dialogBadgeSnapshot.current));
  const openDialog = (kind: 'identity' | 'footer' | 'category' | 'item') => {
    if (saving || uploadingItem) return;
    dialogSnapshot.current = structuredClone(draft);
    dialogBadgeSnapshot.current = draftBadge;
    setDialog(kind);
  };
  const cancelDialog = () => {
    if (saving || uploadingItem) return;
    if (dialogSnapshot.current) { setDraft(dialogSnapshot.current); setDraftBadge(dialogBadgeSnapshot.current); }
    dialogSnapshot.current = null;
    setDialog(null);
  };
  const applyDialog = async () => {
    if (onboardingStep !== null) { dialogSnapshot.current = null; setDialog(null); return; }
    if (await save()) { dialogSnapshot.current = null; setDialog(null); }
  };
  const selectedSection = useMemo(
    () => draft.sections.find((section) => section.id === selectedCategoryId) || null,
    [draft.sections, selectedCategoryId],
  );
  const selectedItem = useMemo(
    () => draft.items.find((item) => item.id === selectedItemId) || null,
    [draft.items, selectedItemId],
  );
  useEffect(() => {
    const normalized = normalizeMenuCatalog(menu, maxItems ?? 250);
    if (!needsMenuOnboarding(normalized)) {
      setOnboardingStep(null);
      setDraft(normalized);
    } else if (onboardingStep === null) {
      setOnboardingStep(0);
      setDraft(normalized);
    }
  }, [menu, maxItems, onboardingStep]);

useEffect(() => () => {
    if (savedNoticeTimerRef.current !== null) window.clearTimeout(savedNoticeTimerRef.current);
  }, []);

  const update = (producer: (current: MenuCatalog) => MenuCatalog) => {
    setDraft((current) => {
      const next = normalizeMenuCatalog(
        { ...producer(current), updatedAt: new Date().toISOString() },
        maxItems ?? 250,
        { preserveTextEdges: true },
      );
      return next;
    });
    setSaveError('');
  };

  const dismissSavedNotice = () => {
    if (savedNoticeTimerRef.current !== null) window.clearTimeout(savedNoticeTimerRef.current);
    savedNoticeTimerRef.current = null;
    setSavedNotice(null);
  };

  const showSavedNotice = (previousMenu: MenuCatalog) => {
    if (savedNoticeTimerRef.current !== null) window.clearTimeout(savedNoticeTimerRef.current);
    setSavedNotice({ id: Date.now(), previousMenu, previousBadge: showOrbitPageBadge });
    savedNoticeTimerRef.current = window.setTimeout(() => {
      savedNoticeTimerRef.current = null;
      setSavedNotice(null);
    }, MENU_SAVE_NOTICE_DURATION_MS);
  };

  const save = async (menuToSave = draft) => {
    if (saving) return false;
    if (menuFingerprint(menuToSave) === menuFingerprint(persistedMenu) && draftBadge === showOrbitPageBadge) return true;
    const previousMenu = structuredClone(persistedMenu);
    setSaving(true);
    setSaveError('');
    try {
      const normalized = normalizeMenuCatalog(menuToSave, maxItems ?? 250);
      await onSave(parseOrbitPageMenu(normalized), draftBadge);
      setDraft(normalized);
      showSavedNotice(previousMenu);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Menu could not be saved');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveChange = (producer: (current: MenuCatalog) => MenuCatalog) => {
    if (saving || uploadingItem) return;
    const next = normalizeMenuCatalog({ ...producer(draft), updatedAt: new Date().toISOString() }, maxItems ?? 250);
    setDraft(next);
    void save(next);
  };

  const revertUnsavedChanges = () => {
    setDraft(persistedMenu);
    setDraftBadge(showOrbitPageBadge);
    setSaveError('');
  };

  const revertSavedMenu = async () => {
    if (!savedNotice || saving) return;
    const previousMenu = structuredClone(savedNotice.previousMenu);
    setSaving(true);
    setSaveError('');
    try {
      setDraftBadge(savedNotice.previousBadge);
      await onSave(previousMenu, savedNotice.previousBadge);
      setDraft(previousMenu);
      dismissSavedNotice();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : tr('The previous menu version could not be restored.', 'Impossibile ripristinare la versione precedente del menu.'));
    } finally {
      setSaving(false);
    }
  };

  const changeVenueType = (venueType: MenuVenueType) => {
    update((current) => ({ ...current, venueType }));
  };

  const updateItem = (id: string, patch: Partial<MenuItem>) => {
    update((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  };

  const uploadItemImage = async (file?: File, id?: string) => {
    if (!file) return;
    setUploadingItem(id ?? 'logo');
    try {
      const optimized = await optimizeImageForUpload(file, 'cover');
      const result = await uploadApi.uploadImage(optimized, `menu-${id ?? 'logo'}`);
      if (id === undefined) update(current => ({ ...current, logoUrl: result.fullUrl || result.filePath }));
      else updateItem(id, { imageUrl: result.fullUrl || result.filePath, imageAlt: draft.items.find((item) => item.id === id)?.name || '' });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : tr('Image upload failed', 'Caricamento immagine non riuscito'));
    } finally {
      setUploadingItem(null);
    }
  };

  const addSection = () => {
    if (draft.sections.length >= 30) return;
    openDialog('category');
    const id = makeId('section');
    update((current) => ({
      ...current,
      sections: [...current.sections, { id, name: 'New section', visible: true, position: current.sections.length }],
    }));
    setSelectedCategoryId(id);
  };

  const addSubsection = (parentId: string) => {
    if (draft.sections.length >= 30) return;
    const id = makeId('subsection');
    update((current) => ({
      ...current,
      sections: [...current.sections, {
        id, parentId, name: 'New subsection', visible: true, position: current.sections.length,
      }],
    }));
    setSelectedCategoryId(id);
  };

  const removeSection = (sectionId: string) => {
    const section = draft.sections.find((candidate) => candidate.id === sectionId);
    if (!section || saving || (!section.parentId && rootSections.length <= 1)) return;
    if (!window.confirm(tr('Delete “{name}”, its subsections and all their items?', 'Eliminare “{name}”, le sue sottosezioni e tutti i loro elementi?').replace('{name}', section.name))) return;
    setSelectedCategoryId(null);
    saveChange((current) => {
      const removedIds = new Set([sectionId, ...current.sections.filter((candidate) => candidate.parentId === sectionId).map((candidate) => candidate.id)]);
      return {
        ...current,
        sections: orderedSectionTree(current.sections.filter((candidate) => !removedIds.has(candidate.id))).map((candidate, position) => ({ ...candidate, position })),
        items: current.items.filter((item) => !removedIds.has(item.sectionId)),
      };
    });
  };

  const addItem = (sectionId = selectedCategoryId || draft.sections[0]?.id) => {
    if (!sectionId || (maxItems !== null && draft.items.length >= maxItems)) return;
    openDialog('item');
    const id = makeId('item');
    update((current) => ({
      ...current,
      items: [...current.items, {
        id, sectionId, name: 'New item', description: '', priceMinor: 0,
        variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: current.items.length,
      }],
    }));
    setSelectedItemId(id);
  };

  const removeItem = (itemId: string) => {
    const item = draft.items.find((candidate) => candidate.id === itemId);
    if (!item || saving || !window.confirm(tr('Delete “{name}”?', 'Eliminare “{name}”?').replace('{name}', item.name))) return;
    saveChange((current) => ({ ...current, items: current.items.filter((candidate) => candidate.id !== itemId).map((candidate, position) => ({ ...candidate, position })) }));
  };

  const rootSections = useMemo(() => sectionSiblings(draft.sections), [draft.sections]);
  const sortedSections = useMemo(() => orderedSectionTree(draft.sections), [draft.sections]);
  const openCategoryEditor = (sectionId: string) => {
    if (saving || uploadingItem) return;
    openDialog('category');
    setSelectedCategoryId(sectionId);
  };

  const renderCategoryEditor = (section: MenuSection) => {
    const nested = Boolean(section.parentId);
    return (
      <section className="menu-category-editor" aria-label={tr("Selected category", "Categoria selezionata")}>
            <div className="menu-category-editor__heading">
              <label>
                <Switch
                  checked={section.visible}
                  aria-label={tr("Show category", "Mostra categoria")}
                  onCheckedChange={(checked) => update((current) => ({
                    ...current,
                    sections: current.sections.map((candidate) => candidate.id === section.id ? { ...candidate, visible: checked } : candidate),
                  }))}
                />
                <span>{section.visible ? tr("Visible", "Visibile") : tr("Hidden", "Nascosta")}</span>
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="selected-menu-category-name">{tr("Name", "Nome")}</Label>
              <Input
                id="selected-menu-category-name"
                value={section.name}
                onChange={(event) => update((current) => ({
                  ...current,
                  sections: current.sections.map((candidate) => candidate.id === section.id ? { ...candidate, name: event.target.value } : candidate),
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selected-menu-category-description">{tr("Optional description", "Descrizione facoltativa")}</Label>
              <Textarea
                id="selected-menu-category-description"
                value={section.description || ''}
                onChange={(event) => update((current) => ({
                  ...current,
                  sections: current.sections.map((candidate) => candidate.id === section.id ? { ...candidate, description: event.target.value } : candidate),
                }))}
              />
            </div>
            <div className="menu-section-settings"><label className="menu-section-collapse-setting">
              <Switch checked={section.collapsible !== false} aria-label={tr('Allow collapsing this section', 'Consenti di chiudere questa sezione')} onCheckedChange={(collapsible) => update((current) => ({ ...current, sections: current.sections.map((candidate) => candidate.id === section.id ? { ...candidate, collapsible } : candidate) }))} />
              <span>{tr('Allow collapsing this section', 'Consenti di chiudere questa sezione')}</span>
            </label>{!nested && <label className="menu-section-collapse-setting">
              <Switch checked={section.showNumber !== false} aria-label={tr('Show section number', 'Mostra numero sezione')} onCheckedChange={(showNumber) => update(current => ({ ...current, sections: current.sections.map(candidate => candidate.id === section.id ? { ...candidate, showNumber } : candidate) }))} />
              <span>{tr('Show section number', 'Mostra numero sezione')} <small>01, 02, 03…</small></span>
            </label>}</div>
            <div className="menu-category-editor__actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.sections.length >= 30}
                onClick={() => addSubsection(section.parentId || section.id)}
              >
                <Plus className="h-4 w-4" />{nested ? tr("Another subcategory", "Altra sottocategoria") : tr("Subcategory", "Sottocategoria")}
              </Button>
            </div>
      </section>
    );
  };

  const moveItem = (itemId: string, direction: -1 | 1) => {
    const item = draft.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const siblings = draft.items.filter((candidate) => candidate.sectionId === item.sectionId);
    const index = siblings.findIndex((candidate) => candidate.id === itemId);
    const target = siblings[index + direction];
    if (target) saveChange((current) => ({ ...current, items: reorderMenuItems(current.items, itemId, target.id) }));
  };

  const renderActions = (kind: 'item' | 'section', id: string) => {
    const entry = kind === 'item' ? draft.items.find((item) => item.id === id)! : draft.sections.find((section) => section.id === id)!;
    const siblings = kind === 'item' ? draft.items.filter((item) => item.sectionId === (entry as MenuItem).sectionId) : sectionSiblings(draft.sections, (entry as MenuSection).parentId);
    const index = siblings.findIndex((candidate) => candidate.id === id);
    const move = (direction: -1 | 1) => kind === 'item' ? moveItem(id, direction) : saveChange((current) => ({ ...current, sections: moveMenuSection(current.sections, id, direction) }));
    const canDelete = kind === 'item' || Boolean((entry as MenuSection).parentId) || rootSections.length > 1;
    return <div className="menu-preview-actions" role="group" aria-label={tr('Actions for {name}', 'Azioni per {name}').replace('{name}', entry.name)}>
      <button type="button" title={tr('Move up', 'Sposta su')} aria-label={tr('Move up', 'Sposta su')} disabled={saving || index <= 0} onClick={() => move(-1)}><ArrowUp /></button>
      <button type="button" title={tr('Move down', 'Sposta giù')} aria-label={tr('Move down', 'Sposta giù')} disabled={saving || index >= siblings.length - 1} onClick={() => move(1)}><ArrowDown /></button>
      <button type="button" title={tr('Delete', 'Elimina')} aria-label={kind === 'item' ? tr('Delete item', 'Elimina elemento') : tr('Delete section', 'Elimina sezione')} disabled={saving || !canDelete} onClick={() => kind === 'item' ? removeItem(id) : removeSection(id)}><Trash2 /></button>
    </div>;
  };

  const itemEditor = selectedItem ? (
                  <article key={selectedItem.id} className="menu-product-editor">
                    <div className="menu-product-editor__heading">
                      <div>
                        <small>{tr('Edit item', 'Modifica elemento')}</small>
                        <strong>{selectedItem.name || tr("Untitled item", "Elemento senza nome")}</strong>
                      </div>
                    </div>
                    <section className="menu-item-form-section" aria-label={tr('Item information', 'Informazioni elemento')}>
                <div className="menu-product-editor__top">
                  <div className="menu-item-image-field">
                    <label className="menu-product-image">
                      <span className="sr-only">{tr('Upload item image', 'Carica immagine elemento')}</span>
                      {selectedItem.imageUrl ? <img src={selectedItem.imageUrl} alt="" /> : uploadingItem === selectedItem.id ? <OrbitLoader size={20} state="composing" /> : <ImagePlus />}
                      <input type="file" accept={RASTER_IMAGE_ACCEPT} onChange={(event) => void uploadItemImage(event.target.files?.[0], selectedItem.id)} />
                    </label>
                    <span>{selectedItem.imageUrl ? tr('Change image', 'Cambia immagine') : tr('Add image', 'Aggiungi immagine')}</span>
                    {selectedItem.imageUrl && <button type="button" className="menu-remove-image-action" onClick={() => updateItem(selectedItem.id, { imageUrl: undefined, imageAlt: undefined })}>{tr("Remove image", "Rimuovi immagine")}</button>}
                  </div>
                  <div className="menu-item-name-price min-w-0 grid flex-1 gap-3 md:grid-cols-[1fr_9rem]">
                    <div className="space-y-2"><Label htmlFor={`menu-item-name-${selectedItem.id}`}>{tr("Name", "Nome")}</Label><Input id={`menu-item-name-${selectedItem.id}`} value={selectedItem.name} onChange={(e) => updateItem(selectedItem.id, { name: e.target.value })} /></div>
                    <div className="space-y-2"><p>{tr("Price", "Prezzo")} ({draft.currency})</p><PriceInput value={selectedItem.priceMinor} locale={draft.locale} label={tr('Item price', 'Prezzo elemento')} onChange={(priceMinor) => updateItem(selectedItem.id, { priceMinor })} /></div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><Label htmlFor={`menu-item-description-${selectedItem.id}`}>{tr("Description", "Descrizione")}</Label><Textarea id={`menu-item-description-${selectedItem.id}`} value={selectedItem.description || ''} onChange={(e) => updateItem(selectedItem.id, { description: e.target.value })} /></div>
                  <div className="space-y-2 md:col-span-2"><Label htmlFor={`menu-item-section-${selectedItem.id}`}>{tr("Category", "Categoria")}</Label><select id={`menu-item-section-${selectedItem.id}`} value={selectedItem.sectionId} onChange={(e) => { updateItem(selectedItem.id, { sectionId: e.target.value });  }}>{rootSections.map((section) => <optgroup key={section.id} label={section.name}><option value={section.id}>{section.name}</option>{sectionSiblings(sortedSections, section.id).map((subsection) => <option key={subsection.id} value={subsection.id}>↳ {subsection.name}</option>)}</optgroup>)}</select></div>
                </div>
                    </section>
                    <details className="menu-item-form-section menu-item-more-details">
                      <summary>{tr('More details and dietary information', 'Altri dettagli e informazioni alimentari')}<span>{tr('Optional', 'Facoltativo')}</span></summary>
                      <div className="menu-item-more-details__fields">
                  <div className="space-y-2"><Label htmlFor={`menu-item-details-${selectedItem.id}`}>{tr("Details", "Dettagli")}</Label><Input id={`menu-item-details-${selectedItem.id}`} placeholder="250 ml, 12% vol, seasonal" value={selectedItem.details || ''} onChange={(e) => updateItem(selectedItem.id, { details: e.target.value })} /></div>
                  <div className="space-y-2"><p>{tr("Dietary tags", "Indicazioni alimentari")}</p><TagsInput label="Dietary tags" value={selectedItem.dietaryTags} onChange={(dietaryTags) => updateItem(selectedItem.id, { dietaryTags })} placeholder="Vegan, vegetarian" /></div>
                  <div className="space-y-2"><p>{tr("Allergens", "Allergeni")}</p><TagsInput label="Allergens" value={selectedItem.allergens} onChange={(allergens) => updateItem(selectedItem.id, { allergens })} placeholder="Gluten, milk, nuts" /></div>
                      </div>
                    </details>
                <div className="menu-item-visibility">
                  <div className="menu-item-form-section__title"><strong>{tr('Visibility', 'Visibilità')}</strong><span>{tr('Control how this item appears on the public menu.', 'Scegli come appare nel menu pubblico.')}</span></div>
                  <div className="menu-product-flags">
                  <label><Switch aria-label={tr("Available", "Disponibile")} checked={selectedItem.available} onCheckedChange={(available) => updateItem(selectedItem.id, { available })} /><span><strong>{tr("Available", "Disponibile")}</strong><small>{tr('Show this item to visitors', 'Mostra questo elemento ai visitatori')}</small></span></label>
                  <label><Switch aria-label={tr("Featured", "In evidenza")} checked={selectedItem.featured} onCheckedChange={(featured) => updateItem(selectedItem.id, { featured })} /><span><strong>{tr("Featured", "In evidenza")}</strong><small>{tr('Highlight it in the menu', 'Mettilo in evidenza nel menu')}</small></span></label>
                  </div>
                </div>
                  </article>
                ) : (
                  <div className="menu-product-editor-empty">
                    <UtensilsCrossed aria-hidden="true" />
                    <strong>{tr("Select an item to edit", "Seleziona un elemento da modificare")}</strong>
                    <span>{tr("Its content, price and availability will appear here.", "Qui compariranno contenuto, prezzo e disponibilità.")}</span>
                  </div>
                );

  const appearanceFields = <>
        <section className="admin-panel space-y-5">
          <div className="menu-editor-section-title"><Palette /><div><h3>{tr("Menu appearance", "Aspetto del menu")}</h3><p>{tr("Independent from the main OrbitPage theme.", "Indipendente dal tema principale OrbitPage.")}</p></div></div>
          <div className="space-y-2">
            <Label htmlFor="menu-logo">{tr('Menu logo', 'Logo del menu')}</Label>
            {draft.logoUrl && <img className="menu-logo-preview" src={draft.logoUrl} alt={tr('Menu logo', 'Logo del menu')} />}
            <Input id="menu-logo" type="file" accept={RASTER_IMAGE_ACCEPT} disabled={Boolean(uploadingItem)} onChange={event => { void uploadItemImage(event.target.files?.[0]); event.target.value = ''; }} />
            {uploadingItem === 'logo' && <span role="status">{tr('Uploading logo…', 'Caricamento logo…')}</span>}
            {draft.logoUrl && <Button variant="outline" disabled={Boolean(uploadingItem)} onClick={() => update(current => ({ ...current, logoUrl: '' }))}>{tr('Remove logo', 'Rimuovi logo')}</Button>}
          </div>
          <div className="menu-theme-presets">
            {(Object.keys(MENU_THEME_PRESETS) as MenuThemePreset[]).map((preset) => {
              const value = MENU_THEME_PRESETS[preset];
              return <button key={preset} type="button" className={draft.theme.preset === preset ? 'active' : ''} onClick={() => update((current) => ({ ...current, theme: { ...value } }))}><i style={{ background: value.background }}><b style={{ background: value.accent }} /><span style={{ background: value.surface }} /></i><strong>{preset}</strong></button>;
            })}
          </div>
          {advancedTheme ? (
            <div className="menu-color-grid">
              {(['background', 'surface', 'text', 'muted', 'accent', 'border'] as const).map((key) => (
                <div className="menu-color-field" key={key}>
                  <span>{key}</span>
                  <ColorPicker
                    label={`${key} color`}
                    value={draft.theme[key]}
                    onChange={(value) => update((current) => ({ ...current, theme: { ...current.theme, [key]: value } }))}
                  />
                </div>
              ))}
              <label><span>{tr('Typography', 'Tipografia')}</span><select value={draft.theme.fontFamily || 'editorial'} onChange={event => update(current => ({ ...current, theme: { ...current.theme, fontFamily: event.target.value as MenuCatalog['theme']['fontFamily'] } }))}><option value="editorial">Editorial</option><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></label>
              <label><span>{tr('Images', 'Immagini')}</span><select value={draft.theme.imageLayout} onChange={event => update(current => ({ ...current, theme: { ...current.theme, imageLayout: event.target.value as 'compact' | 'cover' } }))}><option value="compact">Compact</option><option value="cover">Cover</option></select></label>
              <label><span>Corner radius</span><Input type="number" min="0" max="28" value={draft.theme.radius} onChange={(e) => update((current) => ({ ...current, theme: { ...current.theme, radius: Number(e.target.value) } }))} /></label>
            </div>
          ) : <p className="menu-plan-note">Starter includes curated menu themes. Fine-tuned colors and layout unlock on Pro.</p>}
        </section>

  </>;
  const identityFields = <>
        <section className="admin-panel space-y-5">
          <div className="menu-venue-switch" role="group" aria-label={tr("Venue type", "Tipo di locale")}>
            {(['restaurant', 'bar', 'cafe', 'other'] as const).map((type) => (
              <button key={type} type="button" className={draft.venueType === type ? 'active' : ''} onClick={() => changeVenueType(type)}>
                {type === 'restaurant' ? tr('Restaurant', 'Ristorante') : type === 'bar' ? 'Bar' : type === 'cafe' ? 'Café' : tr('Other', 'Altro')}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="menu-name">{tr("Title", "Titolo")}</Label><Input id="menu-name" value={draft.name} onChange={(e) => update((current) => ({ ...current, name: e.target.value }))} /></div>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
              <div className="space-y-2"><Label htmlFor="menu-currency">{tr("Currency", "Valuta")}</Label><Input id="menu-currency" maxLength={3} value={draft.currency} onChange={(e) => update((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} /></div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="menu-locale">Locale</Label>
                <select
                  id="menu-locale"
                  className="menu-locale-select block h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={draft.locale}
                  onChange={(event) => update((current) => ({ ...current, locale: event.target.value }))}
                >
                  {!MENU_LOCALE_OPTIONS.some((option) => option.value === draft.locale) && <option value={draft.locale}>{draft.locale}</option>}
                  {MENU_LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{tr(option.label, option.labelIt)} · {option.value}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="menu-description">{tr("Description", "Descrizione")}</Label><Textarea id="menu-description" value={draft.description} onChange={(e) => update((current) => ({ ...current, description: e.target.value }))} /></div>
        </section>

  </>;

  if (!enabled) {
    return (
      <section className="admin-panel menu-upgrade-panel">
        <div className="menu-upgrade-panel__icon"><UtensilsCrossed /></div>
        <p>OrbitPage Menu</p>
        <h2>{tr("Turn the page into a complete venue destination.", "Trasforma la pagina in una destinazione completa per il tuo locale.")}</h2>
        <div>{tr("Free can link an external menu. Starter adds a native, editable menu with categories, products, themes and a QR-ready public URL.", "Free può collegare un menu esterno. Starter aggiunge un menu nativo modificabile con categorie, prodotti, temi e un URL pubblico pronto per il QR.")}</div>
        <Button asChild><a href="/dashboard/billing" target="_top">{tr("View Starter and Pro", "Vedi Starter e Pro")}</a></Button>
      </section>
    );
  }

  const publicationButton = <button className="button primary" disabled={isDirty || saving || Boolean(uploadingItem)} title={isDirty ? tr('Save or revert your changes first.', 'Salva o annulla prima le modifiche.') : undefined} type="button" onClick={() => void save({ ...draft, enabled: !draft.enabled })}>{saving ? <OrbitLoader size={16} /> : draft.enabled ? <Download size={16} /> : <UploadCloud size={16} />}{draft.enabled ? tr('Unpublish', 'Rimuovi pubblicazione') : tr('Publish menu', 'Pubblica menu')}</button>;
  const previewControls = <div className="shop-preview-toolbar"><PreviewDeviceToggle value={device} onChange={setDevice} /><div className="shop-preview-publication">{publicationButton}</div></div>;
  const setupLabels = [tr('Your venue', 'Il tuo locale'), tr('Categories', 'Categorie'), tr('Menu items', 'Piatti ed elementi')];
  const setupReady = draft.name.trim() && draft.sections.every(section => section.name.trim());
  const nextSetupStep = () => {
    if (onboardingStep === 0) {
      const seed = `${draft.venueType}:${draft.locale}`;
      if (seed !== seededFor && !draft.items.length) {
        update(current => ({ ...current, description: '', sections: menuStarterSections(current.venueType, current.locale) }));
        setSeededFor(seed);
      }
    }
    setOnboardingStep(step => (step ?? 0) + 1);
  };

  return (
    <div className={"menu-editor-stack menu-editor-stack--visual"}>
      <div className="menu-editor-main shop-workspace">
        <>
          {onboardingStep !== null ? <section className="menu-onboarding" aria-label={tr('Set up your menu', 'Configura il tuo menu')}>
            <header><p>OrbitPage Menu</p><h2>{tr('Create your venue menu', 'Crea il menu del tuo locale')}</h2><ol aria-label={tr('Setup progress', 'Avanzamento configurazione')}>{setupLabels.map((label, index) => <li key={label} aria-current={onboardingStep === index ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol></header>
            {saveError && <p role="alert">{saveError}</p>}
            <fieldset disabled={saving || Boolean(uploadingItem)}>
            <h3 ref={setupHeading} tabIndex={-1}>{setupLabels[onboardingStep]}</h3>
            {onboardingStep === 0 && <>
              <label>{tr('Venue name', 'Nome del locale')}<Input maxLength={120} value={draft.name} onChange={event => update(current => ({ ...current, name: event.target.value }))} /></label>
              <div className="menu-onboarding-identity">
                <label>{tr('Venue type', 'Tipo di locale')}<select value={draft.venueType} onChange={event => changeVenueType(event.target.value as MenuVenueType)}><option value="restaurant">{tr('Restaurant', 'Ristorante')}</option><option value="bar">Bar</option><option value="cafe">Café</option><option value="other">{tr('Other', 'Altro')}</option></select></label>
                <label>{tr('Menu language', 'Lingua del menu')}<select value={draft.locale} onChange={event => update(current => ({ ...current, locale: event.target.value }))}>{MENU_LOCALE_OPTIONS.map(option => <option key={option.value} value={option.value}>{tr(option.label, option.labelIt)}</option>)}</select></label>
              </div>
              <label>{tr('Logo (optional)', 'Logo (facoltativo)')}<Input type="file" accept={RASTER_IMAGE_ACCEPT} onChange={event => void uploadItemImage(event.target.files?.[0])} /></label>
              {draft.logoUrl && <div className="menu-onboarding-logo"><img src={draft.logoUrl} alt={tr('Venue logo', 'Logo del locale')} /><Button variant="outline" onClick={() => update(current => ({ ...current, logoUrl: undefined }))}>{tr('Remove logo', 'Rimuovi logo')}</Button></div>}
            </>}
            {onboardingStep === 1 && <>
              <p>{tr('We prepared categories for your venue and language. Rename, reorder or remove them, and add your own.', 'Abbiamo preparato le categorie per il tuo locale e la lingua scelta. Rinominale, riordinale, rimuovile o aggiungine altre.')}</p>
              <div className="menu-onboarding-categories">{draft.sections.map((section, index) => <div key={section.id}>
                <Input aria-label={`${tr('Category', 'Categoria')} ${index + 1}`} maxLength={80} value={section.name} onChange={event => update(current => ({ ...current, sections: current.sections.map(candidate => candidate.id === section.id ? { ...candidate, name: event.target.value } : candidate) }))} />
                <Button variant="outline" size="icon" aria-label={`${tr('Move up', 'Sposta su')} ${index + 1}`} disabled={index === 0} onClick={() => update(current => ({ ...current, sections: moveMenuSection(current.sections, section.id, -1) }))}><ArrowUp /></Button>
                <Button variant="outline" size="icon" aria-label={`${tr('Move down', 'Sposta giù')} ${index + 1}`} disabled={index === draft.sections.length - 1} onClick={() => update(current => ({ ...current, sections: moveMenuSection(current.sections, section.id, 1) }))}><ArrowDown /></Button>
                <Button variant="outline" size="icon" aria-label={`${tr('Remove category', 'Rimuovi categoria')} ${index + 1}`} disabled={draft.sections.length <= 1 || draft.items.some(item => item.sectionId === section.id)} onClick={() => update(current => ({ ...current, sections: current.sections.filter(candidate => candidate.id !== section.id) }))}><Trash2 /></Button>
              </div>)}</div>
              <Button variant="outline" disabled={draft.sections.length >= 30} onClick={() => update(current => ({ ...current, sections: [...current.sections, { id: makeId('section'), name: '', visible: true, position: current.sections.length }] }))}><Plus />{tr('Add category', 'Aggiungi categoria')}</Button>
            </>}
            {onboardingStep === 2 && <>
              <p>{tr('Add dishes or drinks inside each category. You can keep editing after setup.', 'Aggiungi piatti o bevande nelle categorie. Potrai continuare a modificarli dopo la configurazione.')}</p>
              {draft.sections.map(section => <section key={section.id} className="menu-onboarding-items"><h4>{section.name}</h4><ul>{draft.items.filter(item => item.sectionId === section.id).map(item => <li key={item.id}><Button variant="outline" onClick={() => { setSelectedItemId(item.id); openDialog('item'); }}>{item.name}</Button><span>{formatMenuPriceInput(item.priceMinor, draft.locale)} {draft.currency}</span></li>)}</ul><Button variant="outline" disabled={maxItems !== null && draft.items.length >= maxItems} onClick={() => addItem(section.id)}><Plus />{tr('Add item to', 'Aggiungi elemento a')} {section.name}</Button></section>)}
            </>}
            </fieldset>
            <footer>{onboardingStep > 0 && <Button variant="outline" disabled={saving || Boolean(uploadingItem)} onClick={() => setOnboardingStep(step => (step ?? 1) - 1)}>{tr('Back', 'Indietro')}</Button>}{onboardingStep < 2 ? <Button disabled={!setupReady || saving || Boolean(uploadingItem)} onClick={nextSetupStep}>{tr('Continue', 'Continua')}</Button> : <Button disabled={!setupReady || saving || Boolean(uploadingItem)} onClick={async () => { if (await save({ ...draft, setupCompleted: true, updatedAt: new Date().toISOString() })) setOnboardingStep(null); }}>{saving ? tr('Saving', 'Salvataggio') : tr('Finish setup', 'Completa configurazione')}</Button>}</footer>
          </section> : <>
          {deviceSlot && createPortal(previewControls, deviceSlot)}
          <fieldset disabled={saving || Boolean(uploadingItem)} className={`menu-preview-toolbar shop-view-toolbar${deviceSlot ? " has-preview-slot" : ""}`}>
            <div className="shop-toolbar-left"><button className="shop-tool-button shop-personalize-button" aria-label={tr('Personalize', 'Personalizza')} title={tr('Personalize', 'Personalizza')} type="button" onClick={() => setActivePanel(activePanel === 'appearance' ? 'content' : 'appearance')} aria-expanded={activePanel === 'appearance'}><Palette size={18} /><span>{tr('Personalize', 'Personalizza')}</span></button></div>
            <div className="shop-toolbar-publication">{publicationButton}</div>
            <div className="shop-toolbar-right"><button className="button secondary compact shop-catalog-button" aria-label={tr('Add section', 'Aggiungi sezione')} disabled={draft.sections.length >= 30} type="button" onClick={addSection}><ListTree size={14} /><span>{tr('Add section', 'Aggiungi sezione')}</span></button><button className="button primary compact shop-add-product-button" aria-label={tr('Add item', 'Aggiungi elemento')} disabled={maxItems !== null && draft.items.length >= maxItems} type="button" onClick={() => addItem()}><Plus size={16} /><span>{tr('Add item', 'Aggiungi elemento')}</span></button>{!deviceSlot && <PreviewDeviceToggle value={device} onChange={setDevice} />}</div>
          </fieldset>
          <div className={`menu-preview-workspace${activePanel === 'appearance' ? ' has-personalize' : ''}`}>
            <section className="menu-preview-canvas shop-storefront-canvas visual-site-editor__canvas" aria-label={tr('Menu preview', 'Anteprima menu')}>
              <PreviewDeviceFrame device={device} publicPageHref="/menu"><div className="admin-menu-live-preview"><MenuView renderItemActions={id => renderActions('item', id)} renderSectionActions={id => renderActions('section', id)} menu={draft} showOrbitPageBadge={draftBadge} onEditFooter={() => openDialog('footer')} onEditIdentity={() => openDialog('identity')} onEditSection={openCategoryEditor} onEditItem={id => { if (saving || uploadingItem) return; setSelectedItemId(id); openDialog('item'); }} /></div></PreviewDeviceFrame>
            </section>
            {activePanel === 'appearance' && <aside className="menu-personalize" aria-label={tr('Personalize menu', 'Personalizza menu')}><header><h3>{tr('Personalize', 'Personalizza')}</h3><Button variant="ghost" size="icon" aria-label={tr('Close Personalize', 'Chiudi Personalizza')} onClick={() => setActivePanel('content')}><X className="h-4 w-4" /></Button></header><fieldset disabled={saving}>{appearanceFields}</fieldset></aside>}
          </div>
          </>}
          <Dialog open={Boolean(dialog)} onOpenChange={open => { if (!open) cancelDialog(); }}>
            <DialogContent className="menu-editor-dialog orbitpage-admin" overlayClassName="menu-editor-dialog-overlay" dirty={popupDirty || Boolean(uploadingItem)} onEscapeKeyDown={event => { if (saving || uploadingItem) event.preventDefault(); }}>
              <DialogHeader><DialogTitle>{dialog === 'identity' ? tr('Menu title and description', 'Titolo e descrizione menu') : dialog === 'footer' ? tr('Footer', 'Footer') : dialog === 'category' ? tr('Edit section', 'Modifica sezione') : tr('Edit item', 'Modifica elemento')}</DialogTitle><DialogDescription>{onboardingStep !== null ? tr('Changes are saved when you finish setup.', 'Le modifiche vengono salvate al termine della configurazione.') : tr('Applying changes saves the menu automatically.', 'Applicando le modifiche, il menu viene salvato automaticamente.')}</DialogDescription></DialogHeader>
              {saveError && dialog && <p className="menu-dialog-error" role="alert">{saveError}</p>}
              <div className="menu-editor-dialog-body"><fieldset disabled={saving || Boolean(uploadingItem)} className="menu-editor-dialog-fields">
                {dialog === 'identity' && identityFields}
                {dialog === 'footer' && <><Label htmlFor="menu-footer">{tr('Footer text', 'Testo del footer')}</Label><Textarea id="menu-footer" maxLength={500} value={draft.footerText} onChange={event => update(current => ({ ...current, footerText: event.target.value }))} /><label className="menu-footer-branding"><span>Made with OrbitPage</span><Switch aria-label="Made with OrbitPage" checked={draftBadge} disabled={!brandingEditable} onCheckedChange={setDraftBadge} /></label><small className="menu-footer-branding-note">{tr("Applies to every page in this workspace.", "Si applica a tutte le pagine di questo workspace.")}</small></>}
                {dialog === 'category' && selectedSection && renderCategoryEditor(selectedSection)}
                {dialog === 'item' && itemEditor}
              </fieldset></div>
              <DialogFooter className="menu-editor-dialog-footer"><Button variant="outline" disabled={saving || Boolean(uploadingItem)} onClick={cancelDialog}>{tr('Cancel', 'Annulla')}</Button><Button disabled={saving || Boolean(uploadingItem) || !draft.name.trim() || (dialog === 'category' && !selectedSection?.name.trim()) || (dialog === 'item' && !selectedItem?.name.trim())} onClick={() => void applyDialog()}>{tr('Apply', 'Applica')}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </>

      </div>
      {onboardingStep === null && typeof document !== 'undefined' && (isDirty || saving || savedNotice) ? createPortal(
        <div className="admin-profile-save-layer">
          {saveError && !dialog && <p className="pointer-events-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{saveError}</p>}
          {(isDirty || saving) && !dialog && (
            <div className="admin-profile-save-float">
              <Button type="button" variant="outline" size="sm" onClick={revertUnsavedChanges} disabled={saving}>
                <RotateCcw className="h-4 w-4" /> {tr('Reset', 'Ripristina')}
              </Button>
              <Button type="button" size="sm" onClick={() => void save()} disabled={!isDirty || saving}>
                {saving ? <OrbitLoader size={16} state="composing" /> : <Save className="h-4 w-4" />}
                {saving ? tr('Saving', 'Salvataggio') : tr('Save', 'Salva')}
              </Button>
            </div>
          )}
          {savedNotice && !dialog && (
            <aside className="admin-profile-saved-notice">
              <div className="admin-profile-saved-notice__content">
                <span className="admin-profile-saved-notice__icon" aria-hidden="true"><Check className="h-4 w-4" /></span>
                <div role="status" aria-live="polite">
                  <strong>{tr('Saved', 'Salvato')}</strong>
                  <small>{tr('It will be visible on the public page in about 10 seconds.', 'Sarà visibile entro circa 10 secondi sulla pagina pubblica.')}</small>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void revertSavedMenu()} disabled={saving}>
                  {saving && <OrbitLoader size={14} state="composing" />}
                  {saving ? tr('Reverting', 'Ripristino') : tr('Revert', 'Ripristina')}
                </Button>
              </div>
              <span className="admin-profile-saved-notice__progress" aria-hidden="true">
                <i key={savedNotice.id} />
              </span>
            </aside>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
