import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Copy, Edit, ExternalLink, Eye, EyeOff, GripVertical,
  ImagePlus, Layers3, ListTree, Palette, Plus, QrCode, RotateCcw, Save, Trash2,
  Search, UtensilsCrossed, X,
} from '@/components/ui/material-icons';
import { Button } from '@/components/ui/button';
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
  MENU_THEME_PRESETS, createDefaultMenu, formatMenuPriceInput, normalizeMenuCatalog, parseMenuPriceInput,
  type MenuCatalog, type MenuItem, type MenuSection, type MenuThemePreset, type MenuVenueType,
} from '@/lib/menu';
import { useAppI18n } from '@/lib/i18n';
import { moveMenuSection, orderedSectionTree, reorderMenuItems, reorderMenuSections, sectionSiblings } from './menu-editor-order';
import './menu-editor-redesign.css';

interface MenuEditorProps {
  menu: MenuCatalog;
  publicPageHref: string;
  enabled: boolean;
  maxItems: number | null;
  advancedTheme: boolean;
  onSave: (menu: MenuCatalog) => Promise<void>;
  onAddMenuLink: () => Promise<void>;
  onPreview?: (menu: MenuCatalog) => void;
  designPreview?: ReactNode;
  presentation?: 'classic' | 'visual';
}

type MenuEditorPanel = 'setup' | 'content' | 'appearance';
type MenuContentPane = 'sections' | 'products';
type SavedMenuNotice = { id: number; previousMenu: MenuCatalog };

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

function MenuQr({ url, color }: { url: string; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !url) return;
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 180,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: color, light: '#ffffff' },
    });
  }, [color, url]);
  return <canvas ref={canvasRef} className="h-auto w-full max-w-[180px]" />;
}

export function MenuEditor({
  menu, publicPageHref, enabled, maxItems, advancedTheme,
  onSave, onAddMenuLink, onPreview, designPreview, presentation = 'classic',
}: MenuEditorProps) {
  const { tr } = useAppI18n();
  const [draft, setDraft] = useState(() => normalizeMenuCatalog(menu, maxItems ?? 250));
  const [saving, setSaving] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [savedNotice, setSavedNotice] = useState<SavedMenuNotice | null>(null);
  const [copied, setCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<MenuEditorPanel>('content');
  const [mobileContentPane, setMobileContentPane] = useState<MenuContentPane>('sections');
  const [mobileEditingItem, setMobileEditingItem] = useState(false);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [itemQuery, setItemQuery] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categoryVisibility, setCategoryVisibility] = useState<'all' | 'visible' | 'hidden'>('all');
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(() => new Set());
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(presentation === 'classic');
  const [visualEditor, setVisualEditor] = useState<'category' | 'item' | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [collapsedItemSectionIds, setCollapsedItemSectionIds] = useState<Set<string>>(() => new Set());
  const [productSectionFilter, setProductSectionFilter] = useState(
    () => presentation === 'visual' ? 'all' : normalizeMenuCatalog(menu, maxItems ?? 250).sections[0]?.id || 'all',
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => normalizeMenuCatalog(menu, maxItems ?? 250).items[0]?.id || null,
  );
  const itemEditorRef = useRef<HTMLElement>(null);
  const categoryEditorRef = useRef<HTMLElement>(null);
  const savedNoticeTimerRef = useRef<number | null>(null);
  const menuUrl = `${publicPageHref.replace(/\/$/, '')}/menu`;
  const persistedMenu = useMemo(() => normalizeMenuCatalog(menu, maxItems ?? 250), [maxItems, menu]);
  const isDirty = useMemo(() => menuFingerprint(draft) !== menuFingerprint(persistedMenu), [draft, persistedMenu]);
  const sectionProducts = useMemo(
    () => productSectionFilter === 'all'
      ? draft.items
      : draft.items.filter((item) => item.sectionId === productSectionFilter),
    [draft.items, productSectionFilter],
  );
  const visibleProducts = useMemo(() => {
    const query = itemQuery.trim().toLocaleLowerCase(draft.locale);
    if (!query) return sectionProducts;
    return sectionProducts.filter((item) => [
      item.name,
      item.description,
      item.details,
      ...item.dietaryTags,
      ...item.allergens,
    ].some((value) => value?.toLocaleLowerCase(draft.locale).includes(query)));
  }, [draft.locale, itemQuery, sectionProducts]);
  const selectedSection = useMemo(
    () => draft.sections.find((section) => section.id === (presentation === 'visual' ? selectedCategoryId : productSectionFilter)) || null,
    [draft.sections, presentation, productSectionFilter, selectedCategoryId],
  );
  const selectedItem = useMemo(
    () => (presentation === 'visual' ? draft.items : visibleProducts).find((item) => item.id === selectedItemId) || null,
    [draft.items, presentation, selectedItemId, visibleProducts],
  );
  const selectedItemSiblings = useMemo(
    () => selectedItem ? draft.items.filter((item) => item.sectionId === selectedItem.sectionId) : [],
    [draft.items, selectedItem],
  );
  const selectedItemIndex = selectedItem
    ? selectedItemSiblings.findIndex((item) => item.id === selectedItem.id)
    : -1;

  useEffect(() => {
    const normalized = normalizeMenuCatalog(menu, maxItems ?? 250);
    setDraft(normalized);
  }, [menu, maxItems]);

  useEffect(() => {
    onPreview?.(draft);
  }, [draft, onPreview]);

  useEffect(() => () => {
    if (savedNoticeTimerRef.current !== null) window.clearTimeout(savedNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    if (productSectionFilter !== 'all' && !draft.sections.some((section) => section.id === productSectionFilter)) {
      setProductSectionFilter('all');
    }
  }, [draft.sections, productSectionFilter]);

  useEffect(() => {
    if (presentation === 'classic' && !visibleProducts.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(visibleProducts[0]?.id || null);
    }
  }, [presentation, selectedItemId, visibleProducts]);

  useEffect(() => {
    if (mobileEditingItem && window.matchMedia('(max-width: 767px)').matches) {
      itemEditorRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [mobileEditingItem, selectedItemId]);

  useEffect(() => {
    if (categoryEditorOpen && presentation === 'visual' && window.matchMedia('(max-width: 767px)').matches) {
      categoryEditorRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [categoryEditorOpen, presentation, selectedCategoryId]);

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
    setSavedNotice({ id: Date.now(), previousMenu });
    savedNoticeTimerRef.current = window.setTimeout(() => {
      savedNoticeTimerRef.current = null;
      setSavedNotice(null);
    }, MENU_SAVE_NOTICE_DURATION_MS);
  };

  const save = async () => {
    if (!isDirty || saving) return;
    const previousMenu = structuredClone(persistedMenu);
    setSaving(true);
    setSaveError('');
    try {
      const normalized = normalizeMenuCatalog(draft, maxItems ?? 250);
      await onSave(normalized);
      setDraft(normalized);
      showSavedNotice(previousMenu);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Menu could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const revertUnsavedChanges = () => {
    setDraft(persistedMenu);
    setSaveError('');
  };

  const revertSavedMenu = async () => {
    if (!savedNotice || saving) return;
    const previousMenu = structuredClone(savedNotice.previousMenu);
    setSaving(true);
    setSaveError('');
    try {
      await onSave(previousMenu);
      setDraft(previousMenu);
      dismissSavedNotice();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : tr('The previous menu version could not be restored.', 'Impossibile ripristinare la versione precedente del menu.'));
    } finally {
      setSaving(false);
    }
  };

  const changeVenueType = (venueType: MenuVenueType) => {
    const seeded = createDefaultMenu(venueType);
    update((current) => ({
      ...current,
      venueType,
      name: current.items.length ? current.name : seeded.name,
      description: current.items.length ? current.description : seeded.description,
      sections: current.items.length ? current.sections : seeded.sections,
      theme: current.items.length ? current.theme : seeded.theme,
    }));
  };

  const updateItem = (id: string, patch: Partial<MenuItem>) => {
    update((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  };

  const addVariant = (item: MenuItem) => {
    if (item.variants.length >= 8) return;
    updateItem(item.id, {
      variants: [...item.variants, { id: makeId('variant'), name: 'Option', priceMinor: item.priceMinor }],
    });
  };

  const uploadItemImage = async (id: string, file?: File) => {
    if (!file) return;
    setUploadingItem(id);
    try {
      const optimized = await optimizeImageForUpload(file, 'cover');
      const result = await uploadApi.uploadImage(optimized, `menu-${id}`);
      updateItem(id, { imageUrl: result.fullUrl || result.filePath, imageAlt: draft.items.find((item) => item.id === id)?.name || '' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image upload failed');
    } finally {
      setUploadingItem(null);
    }
  };

  const addSection = () => {
    if (draft.sections.length >= 30) return;
    const id = makeId('section');
    update((current) => ({
      ...current,
      sections: [...current.sections, { id, name: 'New section', visible: true, position: current.sections.length }],
    }));
    setProductSectionFilter(presentation === 'classic' ? id : 'all');
    setCategoryQuery('');
    setItemQuery('');
    setCategoryVisibility('all');
    setSelectedCategoryId(id);
    setCategoryEditorOpen(true);
    setVisualEditor('category');
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
    setProductSectionFilter(presentation === 'classic' ? id : 'all');
    setCategoryQuery('');
    setItemQuery('');
    setCategoryVisibility('all');
    setSelectedCategoryId(id);
    setCategoryEditorOpen(true);
    setVisualEditor('category');
    setCollapsedCategoryIds((current) => new Set([...current].filter((candidate) => candidate !== parentId)));
  };

  const removeSection = (sectionId: string) => {
    const fallbackSection = sortedSections.find((section) => section.id !== sectionId && section.parentId !== sectionId);
    setProductSectionFilter(presentation === 'classic' ? fallbackSection?.id || 'all' : 'all');
    setSelectedCategoryId(null);
    setCategoryEditorOpen(false);
    setVisualEditor(null);
    update((current) => {
      const removedIds = new Set([
        sectionId,
        ...current.sections.filter((section) => section.parentId === sectionId).map((section) => section.id),
      ]);
      const sections = orderedSectionTree(current.sections.filter((section) => !removedIds.has(section.id)))
        .map((section, position) => ({ ...section, position }));
      return {
        ...current,
        sections,
        items: current.items.filter((item) => !removedIds.has(item.sectionId)),
      };
    });
  };

  const addItem = (sectionId = productSectionFilter !== 'all' ? productSectionFilter : draft.sections[0]?.id) => {
    if (!sectionId || (maxItems !== null && draft.items.length >= maxItems)) return;
    const id = makeId('item');
    update((current) => ({
      ...current,
      items: [...current.items, {
        id, sectionId, name: 'New item', description: '', priceMinor: 0,
        variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: current.items.length,
      }],
    }));
    setProductSectionFilter(presentation === 'classic' ? sectionId : 'all');
    setItemQuery('');
    setSelectedItemId(id);
    setMobileContentPane('products');
    setMobileEditingItem(true);
    setVisualEditor('item');
    const rootId = draft.sections.find((section) => section.id === sectionId)?.parentId || sectionId;
    setCollapsedCategoryIds((current) => new Set([...current].filter((candidate) => candidate !== rootId && candidate !== sectionId)));
  };

  const removeItem = (itemId: string) => {
    const remaining = visibleProducts.filter((candidate) => candidate.id !== itemId);
    setSelectedItemId(remaining[0]?.id || null);
    setMobileEditingItem(false);
    setVisualEditor(null);
    update((current) => ({
      ...current,
      items: current.items
        .filter((candidate) => candidate.id !== itemId)
        .map((candidate, position) => ({ ...candidate, position })),
    }));
  };

  const rootSections = useMemo(() => sectionSiblings(draft.sections), [draft.sections]);
  const sortedSections = useMemo(() => orderedSectionTree(draft.sections), [draft.sections]);
  const categorySearch = categoryQuery.trim().toLocaleLowerCase(draft.locale);
  const matchesVisibility = (section: MenuSection) => categoryVisibility === 'all'
    || (categoryVisibility === 'visible' ? section.visible : !section.visible);
  const matchesSearch = (section: MenuSection) => !categorySearch
    || [section.name, section.description].some((value) => value?.toLocaleLowerCase(draft.locale).includes(categorySearch));
  const categoryGroups = rootSections.map((root) => {
    const rootMatches = matchesVisibility(root) && matchesSearch(root);
    const allChildren = sectionSiblings(draft.sections, root.id);
    const children = allChildren
      .filter((child) => matchesVisibility(child) && (rootMatches || matchesSearch(child)));
    const sectionIds = new Set([root.id, ...allChildren.map((child) => child.id)]);
    const itemCount = draft.items.filter((item) => sectionIds.has(item.sectionId)).length;
    return { root, children, itemCount, shown: rootMatches || children.length > 0 };
  }).filter((group) => group.shown);
  const itemGroups = sortedSections.map((section) => {
    const items = visibleProducts.filter((item) => item.sectionId === section.id);
    const sectionIds = new Set([section.id, ...sectionSiblings(draft.sections, section.id).map((child) => child.id)]);
    return { section, items, count: visibleProducts.filter((item) => sectionIds.has(item.sectionId)).length };
  }).filter((group) => group.count > 0);
  const visualQuery = itemQuery.trim().toLocaleLowerCase(draft.locale);
  const visualCategoryMatches = (section: MenuSection) => !visualQuery
    || [section.name, section.description].some((value) => value?.toLocaleLowerCase(draft.locale).includes(visualQuery));
  const visualItemMatches = (item: MenuItem) => !visualQuery
    || [item.name, item.description, item.details, ...item.dietaryTags, ...item.allergens]
      .some((value) => value?.toLocaleLowerCase(draft.locale).includes(visualQuery));
  const visualGroups = rootSections.map((root) => {
    const rootFilter = productSectionFilter === 'all' || productSectionFilter === root.id;
    const rootMatch = visualCategoryMatches(root);
    const rootItems = rootFilter && matchesVisibility(root)
      ? draft.items.filter((item) => item.sectionId === root.id && (rootMatch || visualItemMatches(item))) : [];
    const children = sectionSiblings(draft.sections, root.id).map((section) => {
      const allowed = (rootFilter || productSectionFilter === section.id) && matchesVisibility(section);
      const items = allowed ? draft.items.filter((item) => item.sectionId === section.id && (rootMatch || visualCategoryMatches(section) || visualItemMatches(item))) : [];
      return { section, items, shown: allowed && (items.length > 0 || rootMatch || visualCategoryMatches(section)) };
    }).filter((group) => group.shown);
    return { root, rootItems, children, count: rootItems.length + children.reduce((total, child) => total + child.items.length, 0), shown: rootItems.length > 0 || children.length > 0 || (rootFilter && matchesVisibility(root) && rootMatch) };
  }).filter((group) => group.shown);
  const openCategoryEditor = (sectionId: string) => {
    if (presentation === 'visual') setSelectedCategoryId(sectionId);
    else setProductSectionFilter(sectionId);
    setCategoryEditorOpen(true);
    setVisualEditor('category');
  };

  const renderCategoryEditor = (section: MenuSection) => {
    const siblings = sectionSiblings(draft.sections, section.parentId);
    const sectionIndex = siblings.findIndex((candidate) => candidate.id === section.id);
    const nested = Boolean(section.parentId);
    const canDelete = nested || rootSections.length > 1;
    return (
      <section className="menu-category-editor" ref={categoryEditorRef} aria-label={tr("Selected category", "Categoria selezionata")}>
            <div className="menu-category-editor__heading">
              <div>
                <span>{nested ? tr("Edit subcategory", "Modifica sottocategoria") : tr("Edit category", "Modifica categoria")}</span>
                <strong>{section.name || tr("Untitled category", "Categoria senza nome")}</strong>
              </div>
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
              {presentation === 'visual' && <button type="button" className="menu-category-editor__close" aria-label={tr('Close category editor', 'Chiudi modifica categoria')} onClick={() => { setCategoryEditorOpen(false); setVisualEditor(null); }}><X aria-hidden="true" /></button>}
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
            <div className="menu-category-editor__actions">
              <div className="menu-category-editor__order">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sectionIndex <= 0}
                  onClick={() => update((current) => ({ ...current, sections: moveMenuSection(current.sections, section.id, -1) }))}
                ><ArrowUp className="h-4 w-4" />{tr("Up", "Su")}</Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sectionIndex < 0 || sectionIndex >= siblings.length - 1}
                  onClick={() => update((current) => ({ ...current, sections: moveMenuSection(current.sections, section.id, 1) }))}
                ><ArrowDown className="h-4 w-4" />{tr("Down", "Giù")}</Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.sections.length >= 30}
                onClick={() => addSubsection(section.parentId || section.id)}
              >
                <Plus className="h-4 w-4" />{nested ? tr("Another subcategory", "Altra sottocategoria") : tr("Subcategory", "Sottocategoria")}
              </Button>
              {canDelete && (
                <Button type="button" variant="ghost" size="sm" className="menu-danger-action" onClick={() => removeSection(section.id)}>
                  <Trash2 className="h-4 w-4" />{tr("Delete", "Elimina")}
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="menu-category-editor__items"
              onClick={() => { if (presentation === 'visual') addItem(section.id); else { setProductSectionFilter(section.id); setMobileContentPane('products'); setMobileEditingItem(false); } }}
            >
              <ListTree className="h-4 w-4" />
              <span>{presentation === 'visual' ? tr('Add item to this category', 'Aggiungi elemento a questa categoria') : tr("Manage items in this category", "Gestisci gli elementi di questa categoria")}</span>
              <strong>{draft.items.filter((item) => item.sectionId === section.id).length}</strong>
            </Button>
      </section>
    );
  };

  const moveItem = (itemId: string, direction: -1 | 1) => {
    const item = draft.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const siblings = draft.items.filter((candidate) => candidate.sectionId === item.sectionId);
    const index = siblings.findIndex((candidate) => candidate.id === itemId);
    const target = siblings[index + direction];
    if (target) update((current) => ({ ...current, items: reorderMenuItems(current.items, itemId, target.id) }));
  };

  const finishDrag = () => {
    setDraggedSectionId(null);
    setDraggedItemId(null);
    setDragOverId(null);
  };

  const categoryDragProps = (section: MenuSection) => ({
    draggable: true,
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      setDraggedSectionId(section.id);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', section.id);
    },
    onDragOver: (event: DragEvent<HTMLButtonElement>) => {
      const source = draft.sections.find((candidate) => candidate.id === draggedSectionId);
      if (!source || source.parentId !== section.parentId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverId(`section:${section.id}`);
    },
    onDrop: (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const source = draft.sections.find((candidate) => candidate.id === draggedSectionId);
      if (source && source.parentId === section.parentId) {
        update((current) => ({ ...current, sections: reorderMenuSections(current.sections, source.id, section.id) }));
      }
      finishDrag();
    },
    onDragEnd: finishDrag,
  });

  const renderItemRow = (item: MenuItem) => (
    <button
      key={item.id}
      type="button"
      className={`menu-item-picker__item${selectedItemId === item.id && (presentation === 'classic' || visualEditor === 'item') ? ' active' : ''}${draggedItemId === item.id ? ' is-dragging' : ''}${dragOverId === `item:${item.id}` ? ' is-drag-over' : ''}`}
      aria-pressed={selectedItemId === item.id && (presentation === 'classic' || visualEditor === 'item')}
      draggable={!itemQuery}
      onDragStart={(event) => {
        if (itemQuery) return;
        setDraggedItemId(item.id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.id);
      }}
      onDragOver={(event) => {
        const source = draft.items.find((candidate) => candidate.id === draggedItemId);
        if (!source || source.sectionId !== item.sectionId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverId(`item:${item.id}`);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const source = draft.items.find((candidate) => candidate.id === draggedItemId);
        if (source && source.sectionId === item.sectionId) {
          update((current) => ({
            ...current,
            items: reorderMenuItems(current.items, source.id, item.id),
          }));
        }
        finishDrag();
      }}
      onDragEnd={finishDrag}
      onClick={() => { if (presentation === 'classic') setItemQuery(''); setSelectedItemId(item.id); setMobileEditingItem(true); setVisualEditor('item'); }}
      aria-label={tr(`Edit ${item.name || 'untitled item'}`, `Modifica ${item.name || 'elemento senza nome'}`)}
    >
      <GripVertical className="menu-order-grip" aria-hidden="true" />
      <span className="menu-item-picker__thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <UtensilsCrossed aria-hidden="true" />}</span>
      <span className="menu-item-picker__copy"><strong>{item.name || tr("Untitled item", "Elemento senza nome")}</strong><small>{presentation === 'visual' ? (item.description || formatMenuPriceInput(item.priceMinor, draft.locale) + ' ' + draft.currency) : `${sortedSections.find((section) => section.id === item.sectionId)?.name || tr('Uncategorized', 'Senza categoria')} · ${formatMenuPriceInput(item.priceMinor, draft.locale)} ${draft.currency}`}</small><em className={item.available ? 'available' : ''}>{item.available ? tr("Available", "Disponibile") : tr("Hidden", "Nascosto")}</em></span>
      {presentation === 'visual' && <span className="menu-unified-item__price">{formatMenuPriceInput(item.priceMinor, draft.locale)} {draft.currency}</span>}
      <ChevronRight className="menu-item-picker__arrow" aria-hidden="true" />
    </button>
  );

  const itemEditor = selectedItem ? (
                  <article key={selectedItem.id} ref={itemEditorRef} className="menu-product-editor">
                    <div className="menu-product-editor__heading">
                      <div>
                        <button type="button" className="menu-product-editor__back" onClick={() => { setMobileEditingItem(false); setVisualEditor(null); }}><ArrowLeft aria-hidden="true" />{tr("Back to items", "Torna agli elementi")}</button>
                        <small>{tr('Edit item', 'Modifica elemento')}</small>
                        <strong>{selectedItem.name || tr("Untitled item", "Elemento senza nome")}</strong>
                      </div>
                    </div>
                    <section className="menu-item-form-section" aria-label={tr('Essential information', 'Informazioni essenziali')}>
                      <div className="menu-item-form-section__title"><strong>{tr('Essential information', 'Informazioni essenziali')}</strong><span>{tr('The name, price and category visitors will see.', 'Nome, prezzo e categoria che vedranno i visitatori.')}</span></div>
                <div className="menu-product-editor__top">
                  <div className="menu-item-image-field">
                    <label className="menu-product-image">
                      <span className="sr-only">{tr('Upload item image', 'Carica immagine elemento')}</span>
                      {selectedItem.imageUrl ? <img src={selectedItem.imageUrl} alt="" /> : uploadingItem === selectedItem.id ? <OrbitLoader size={20} state="composing" /> : <ImagePlus />}
                      <input type="file" accept={RASTER_IMAGE_ACCEPT} onChange={(event) => void uploadItemImage(selectedItem.id, event.target.files?.[0])} />
                    </label>
                    <span>{selectedItem.imageUrl ? tr('Change image', 'Cambia immagine') : tr('Add image', 'Aggiungi immagine')}</span>
                  </div>
                  <div className="min-w-0 grid flex-1 gap-3 md:grid-cols-[1fr_9rem]">
                    <div className="space-y-2"><Label htmlFor={`menu-item-name-${selectedItem.id}`}>{tr("Name", "Nome")}</Label><Input id={`menu-item-name-${selectedItem.id}`} value={selectedItem.name} onChange={(e) => updateItem(selectedItem.id, { name: e.target.value })} /></div>
                    <div className="space-y-2"><p>{tr("Price", "Prezzo")} ({draft.currency})</p><PriceInput value={selectedItem.priceMinor} locale={draft.locale} label={tr('Item price', 'Prezzo elemento')} onChange={(priceMinor) => updateItem(selectedItem.id, { priceMinor })} /></div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><Label htmlFor={`menu-item-description-${selectedItem.id}`}>{tr("Description", "Descrizione")}</Label><Textarea id={`menu-item-description-${selectedItem.id}`} value={selectedItem.description || ''} onChange={(e) => updateItem(selectedItem.id, { description: e.target.value })} /></div>
                  <div className="space-y-2 md:col-span-2"><Label htmlFor={`menu-item-section-${selectedItem.id}`}>{tr("Category", "Categoria")}</Label><select id={`menu-item-section-${selectedItem.id}`} value={selectedItem.sectionId} onChange={(e) => { updateItem(selectedItem.id, { sectionId: e.target.value }); if (presentation === 'classic') setProductSectionFilter(e.target.value); setItemQuery(''); }}>{rootSections.map((section) => <optgroup key={section.id} label={section.name}><option value={section.id}>{section.name}</option>{sectionSiblings(sortedSections, section.id).map((subsection) => <option key={subsection.id} value={subsection.id}>↳ {subsection.name}</option>)}</optgroup>)}</select></div>
                </div>
                    </section>
                    <details className="menu-item-form-section menu-item-more-details" defaultOpen={Boolean(selectedItem.details || selectedItem.dietaryTags.length || selectedItem.allergens.length)}>
                      <summary>{tr('More details and dietary information', 'Altri dettagli e informazioni alimentari')}<span>{tr('Optional', 'Facoltativo')}</span></summary>
                      <div className="menu-item-more-details__fields">
                  <div className="space-y-2"><Label htmlFor={`menu-item-details-${selectedItem.id}`}>{tr("Details", "Dettagli")}</Label><Input id={`menu-item-details-${selectedItem.id}`} placeholder="250 ml, 12% vol, seasonal" value={selectedItem.details || ''} onChange={(e) => updateItem(selectedItem.id, { details: e.target.value })} /></div>
                  <div className="space-y-2"><p>{tr("Dietary tags", "Indicazioni alimentari")}</p><TagsInput label="Dietary tags" value={selectedItem.dietaryTags} onChange={(dietaryTags) => updateItem(selectedItem.id, { dietaryTags })} placeholder="Vegan, vegetarian" /></div>
                  <div className="space-y-2"><p>{tr("Allergens", "Allergeni")}</p><TagsInput label="Allergens" value={selectedItem.allergens} onChange={(allergens) => updateItem(selectedItem.id, { allergens })} placeholder="Gluten, milk, nuts" /></div>
                      </div>
                    </details>
                <div className="menu-variants-editor">
                  <div className="menu-variants-editor__heading">
                    <div><strong>{tr("Sizes and options", "Formati e opzioni")}</strong><span>{tr("Add only if this item has more than one size or price.", "Aggiungili solo se questo elemento ha più formati o prezzi.")}</span></div>
                    <Button type="button" variant="outline" size="sm" disabled={selectedItem.variants.length >= 8} onClick={() => addVariant(selectedItem)}><Plus className="h-4 w-4" />{tr("Add option", "Aggiungi opzione")}</Button>
                  </div>
                  {selectedItem.variants.map((variant) => (
                    <div key={variant.id} className="menu-variant-row">
                      <Input aria-label="Option name" placeholder="Glass, bottle, large" value={variant.name} onChange={(event) => updateItem(selectedItem.id, {
                        variants: selectedItem.variants.map((candidate) => candidate.id === variant.id ? { ...candidate, name: event.target.value } : candidate),
                      })} />
                      <div className="menu-variant-price"><span>{draft.currency}</span><PriceInput value={variant.priceMinor} locale={draft.locale} label="Option price" onChange={(priceMinor) => updateItem(selectedItem.id, {
                        variants: selectedItem.variants.map((candidate) => candidate.id === variant.id ? { ...candidate, priceMinor } : candidate),
                      })} /></div>
                      <Button aria-label="Delete option" type="button" variant="ghost" size="icon" title="Delete option" onClick={() => updateItem(selectedItem.id, { variants: selectedItem.variants.filter((candidate) => candidate.id !== variant.id) })}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <div className="menu-item-visibility">
                  <div className="menu-item-form-section__title"><strong>{tr('Visibility', 'Visibilità')}</strong><span>{tr('Control how this item appears on the public menu.', 'Scegli come appare nel menu pubblico.')}</span></div>
                  <div className="menu-product-flags">
                  <label><Switch checked={selectedItem.available} onCheckedChange={(available) => updateItem(selectedItem.id, { available })} /><span><strong>{tr("Available", "Disponibile")}</strong><small>{tr('Show this item to visitors', 'Mostra questo elemento ai visitatori')}</small></span></label>
                  <label><Switch checked={selectedItem.featured} onCheckedChange={(featured) => updateItem(selectedItem.id, { featured })} /><span><strong>{tr("Featured", "In evidenza")}</strong><small>{tr('Highlight it in the menu', 'Mettilo in evidenza nel menu')}</small></span></label>
                  {selectedItem.imageUrl && <button type="button" className="menu-remove-image-action" onClick={() => updateItem(selectedItem.id, { imageUrl: undefined, imageAlt: undefined })}>{tr("Remove image", "Rimuovi immagine")}</button>}
                  </div>
                </div>
                <div className="menu-product-editor__actions">
                  <div className="menu-item-order-actions" aria-label={tr('Item order in category', 'Ordine dell’elemento nella categoria')}>
                    <span>{tr('Order in category', 'Ordine nella categoria')}</span>
                    <Button type="button" variant="outline" size="sm" disabled={selectedItemIndex <= 0} onClick={() => moveItem(selectedItem.id, -1)}><ArrowUp aria-hidden="true" className="h-4 w-4" />{tr('Move up', 'Sposta su')}</Button>
                    <Button type="button" variant="outline" size="sm" disabled={selectedItemIndex < 0 || selectedItemIndex >= selectedItemSiblings.length - 1} onClick={() => moveItem(selectedItem.id, 1)}><ArrowDown aria-hidden="true" className="h-4 w-4" />{tr('Move down', 'Sposta giù')}</Button>
                  </div>
                  <div className="menu-item-save-actions">
                    <Button type="button" variant="ghost" size="sm" className="menu-danger-action" onClick={() => removeItem(selectedItem.id)}><Trash2 aria-hidden="true" className="h-4 w-4" />{tr('Delete item', 'Elimina elemento')}</Button>
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

  return (
    <div className={`menu-editor-stack menu-editor-stack--${presentation}`}>
      <div className="menu-editor-main space-y-5">
        <nav className="menu-editor-tabs" aria-label={tr('Menu setup workflow', 'Percorso di configurazione menu')}>
          <button
            type="button"
            className={activePanel === 'setup' ? 'active' : ''}
            aria-current={activePanel === 'setup' ? 'step' : undefined}
            onClick={() => setActivePanel('setup')}
          >
            <span className="menu-editor-tab-index">01</span>
            <span className="menu-editor-tab-copy"><strong>{tr('Settings', 'Impostazioni')}</strong><small>{tr('Details, visibility and sharing', 'Dettagli, visibilità e condivisione')}</small></span>
            <UtensilsCrossed aria-hidden="true" />
          </button>
          <button
            type="button"
            className={activePanel === 'content' && (presentation === 'visual' || mobileContentPane === 'sections') ? 'active' : ''}
            aria-current={activePanel === 'content' && (presentation === 'visual' || mobileContentPane === 'sections') ? 'step' : undefined}
            onClick={() => { setActivePanel('content'); setMobileContentPane('sections'); setMobileEditingItem(false); }}
          >
            <span className="menu-editor-tab-index">02</span>
            <span className="menu-editor-tab-copy"><strong>{presentation === 'visual' ? tr('Menu', 'Menu') : tr('Categories', 'Categorie')}</strong><small>{presentation === 'visual' ? tr('Categories and items', 'Categorie ed elementi') : tr('Build the browsing order', 'Crea l’ordine di navigazione')}</small></span>
            <Layers3 aria-hidden="true" />
          </button>
          {presentation === 'classic' && <button
            type="button"
            className={activePanel === 'content' && mobileContentPane === 'products' ? 'active' : ''}
            aria-current={activePanel === 'content' && mobileContentPane === 'products' ? 'step' : undefined}
              onClick={() => { setActivePanel('content'); setMobileContentPane('products'); setMobileEditingItem(false); }}
          >
            <span className="menu-editor-tab-index">03</span>
            <span className="menu-editor-tab-copy"><strong>{tr('Items', 'Elementi')}</strong><small>{tr('Add names, prices and details', 'Aggiungi nomi, prezzi e dettagli')}</small></span>
            <ListTree aria-hidden="true" />
          </button>}
          <button
            type="button"
            className={activePanel === 'appearance' ? 'active' : ''}
            aria-current={activePanel === 'appearance' ? 'step' : undefined}
            onClick={() => setActivePanel('appearance')}
          >
            <span className="menu-editor-tab-index">{presentation === 'visual' ? '03' : '04'}</span>
            <span className="menu-editor-tab-copy"><strong>{tr('Design', 'Design')}</strong><small>{tr('Style and mobile preview', 'Stile e anteprima mobile')}</small></span>
            <Palette aria-hidden="true" />
          </button>
        </nav>

        {activePanel === 'setup' && <div className="menu-settings-layout">
        <section className="admin-panel space-y-5">
          <div className="menu-editor-section-title"><UtensilsCrossed /><div><h3>{tr("Menu details", "Dettagli del menu")}</h3><p>{tr("Choose the venue type and public heading.", "Scegli il tipo di locale e l'intestazione pubblica.")}</p></div></div>
          <div className="menu-venue-switch" role="group" aria-label={tr("Venue type", "Tipo di locale")}>
            {(['restaurant', 'bar', 'cafe'] as const).map((type) => (
              <button key={type} type="button" className={draft.venueType === type ? 'active' : ''} onClick={() => changeVenueType(type)}>
                {type === 'cafe' ? 'Café' : type[0].toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="menu-name">{tr("Menu name", "Nome menu")}</Label><Input id="menu-name" value={draft.name} onChange={(e) => update((current) => ({ ...current, name: e.target.value }))} /></div>
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
          <div className="space-y-2"><Label htmlFor="menu-description">{tr("Introduction", "Introduzione")}</Label><Textarea id="menu-description" value={draft.description} onChange={(e) => update((current) => ({ ...current, description: e.target.value }))} /></div>
        </section>

        <section className="admin-panel menu-settings-publishing">
          <div className="menu-editor-section-title"><Eye /><div><h3>{tr('Publication', 'Pubblicazione')}</h3><p>{tr('Choose whether visitors can see your menu.', 'Scegli se i visitatori possono vedere il menu.')}</p></div></div>
          <label className="menu-settings-visibility">
            <span><strong>{draft.enabled ? tr('Published', 'Pubblicato') : tr('Unpublished', 'Non pubblicato')}</strong><small>{tr('Public menu visibility', 'Visibilità del menu pubblico')}</small></span>
            <Switch aria-label={tr('Public menu visibility', 'Visibilità del menu pubblico')} checked={draft.enabled} onCheckedChange={(checked) => update((current) => ({ ...current, enabled: checked }))} />
          </label>
        </section>

        <section className="admin-panel menu-publish-tools">
          <div className="menu-editor-section-title"><QrCode /><div><h3>{tr("Public menu", "Menu pubblico")}</h3><p>{tr("The URL is static, cacheable and ready for print.", "L'URL è statico, memorizzabile in cache e pronto per la stampa.")}</p></div></div>
          <div className="menu-publish-tools__grid">
            <MenuQr url={menuUrl} color={draft.theme.text} />
            <div>
              <Label htmlFor="menu-public-url">URL menu</Label>
              <div className="menu-url-row"><Input id="menu-public-url" value={menuUrl} readOnly /><Button aria-label="Copy URL" variant="outline" size="icon" title="Copy URL" onClick={() => { void navigator.clipboard.writeText(menuUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button><Button asChild variant="outline" size="icon"><a aria-label="Open menu" href={menuUrl} target="_blank" rel="noopener noreferrer" title="Open menu"><ExternalLink aria-hidden="true" /></a></Button></div>
              <Button className="mt-4" variant="outline" onClick={() => void onAddMenuLink()}>{tr("Add menu link to main page", "Aggiungi il link al menu nella pagina principale")}</Button>
            </div>
          </div>
        </section>
        </div>}

        {activePanel === 'content' && <section className="menu-content-shell">
          {presentation === 'classic' && (
            <header className="menu-classic-content-map">
              <div className="menu-classic-content-map__intro">
                <p className="admin-eyebrow">{tr('Menu architecture', 'Architettura del menu')}</p>
                <h3>{tr('Build the path your customers follow.', 'Costruisci il percorso che seguiranno i clienti.')}</h3>
                <p>{tr(
                  'Categories group the offer, subcategories add detail, and items contain what can be ordered.',
                  'Le categorie raggruppano l’offerta, le sottocategorie aggiungono dettaglio e gli elementi contengono ciò che si può ordinare.',
                )}</p>
              </div>
              <ol className="menu-classic-content-map__steps">
                <li><span>01</span><div><strong>{tr('Category', 'Categoria')}</strong><small>{tr('Main navigation', 'Navigazione principale')}</small></div></li>
                <li><span>02</span><div><strong>{tr('Subcategory', 'Sottocategoria')}</strong><small>{tr('Optional grouping', 'Raggruppamento facoltativo')}</small></div></li>
                <li><span>03</span><div><strong>{tr('Item', 'Elemento')}</strong><small>{tr('Name, price and availability', 'Nome, prezzo e disponibilità')}</small></div></li>
              </ol>
            </header>
          )}

          {presentation === 'visual' && <div className={`menu-unified-panel${visualEditor ? ' is-editing' : ''}`}>
            <div className="menu-unified-header">
              <div className="menu-unified-header__actions">
                <Button variant="outline" size="sm" onClick={addSection} disabled={draft.sections.length >= 30}><Plus className="h-4 w-4" />{tr('Add category', 'Aggiungi categoria')}</Button>
                <Button size="sm" onClick={() => addItem()} disabled={draft.sections.length === 0 || (maxItems !== null && draft.items.length >= maxItems)}><Plus className="h-4 w-4" />{tr('Add item', 'Aggiungi elemento')}</Button>
              </div>
            </div>
            <div className="menu-unified-layout">
              <div className="menu-unified-list">
                <div className="menu-category-toolbar menu-unified-toolbar">
                  <label className="menu-category-search"><Search aria-hidden="true" /><span className="sr-only">{tr('Search categories and items', 'Cerca categorie ed elementi')}</span><Input type="search" value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder={tr('Search categories and items', 'Cerca categorie ed elementi')} /></label>
                  <select aria-label={tr('Filter by category', 'Filtra per categoria')} value={productSectionFilter} onChange={(event) => setProductSectionFilter(event.target.value)}>
                    <option value="all">{tr('All categories', 'Tutte le categorie')}</option>
                    {sortedSections.map((section) => <option key={section.id} value={section.id}>{section.parentId ? '↳ ' : ''}{section.name}</option>)}
                  </select>
                  <select aria-label={tr('Filter category visibility', 'Filtra visibilità categorie')} value={categoryVisibility} onChange={(event) => setCategoryVisibility(event.target.value as typeof categoryVisibility)}>
                    <option value="all">{tr('All visibility', 'Tutte le visibilità')}</option><option value="visible">{tr('Visible', 'Visibili')}</option><option value="hidden">{tr('Hidden', 'Nascoste')}</option>
                  </select>
                </div>
                <div className="menu-category-groups" aria-label={tr('Menu categories and items', 'Categorie ed elementi del menu')}>
                  {visualGroups.map(({ root, rootItems, children, count }) => {
                    const expanded = Boolean(visualQuery) || !collapsedCategoryIds.has(root.id);
                    return <section className="menu-category-group" key={root.id}>
                      <div className="menu-category-group__heading">
                        <button type="button" {...categoryDragProps(root)} className="menu-category-group__toggle" aria-expanded={expanded} aria-controls={`menu-unified-group-${root.id}`} disabled={Boolean(visualQuery)} onClick={() => setCollapsedCategoryIds((current) => { const next = new Set(current); if (next.has(root.id)) next.delete(root.id); else next.add(root.id); return next; })}>
                          <ChevronRight aria-hidden="true" /><span><strong>{root.name || tr('Untitled category', 'Categoria senza nome')}</strong><small>{root.description || tr('Main category', 'Categoria principale')}</small></span><em>{count}</em>
                        </button>
                        {!root.visible && <span className="menu-category-group__status">{tr('Hidden', 'Nascosta')}</span>}
                        <button type="button" className="menu-category-group__edit" aria-label={tr(`Edit ${root.name}`, `Modifica ${root.name}`)} onClick={() => openCategoryEditor(root.id)}><Edit aria-hidden="true" />{tr('Edit', 'Modifica')}</button>
                      </div>
                      <div className="menu-category-group__body" id={`menu-unified-group-${root.id}`} hidden={!expanded}>
                        <div className="menu-unified-items">{rootItems.map(renderItemRow)}</div>
                        {children.map(({ section, items }) => {
                          const childExpanded = Boolean(visualQuery) || !collapsedCategoryIds.has(section.id);
                          return <section className="menu-unified-subcategory" key={section.id}>
                            <div className="menu-category-group__heading">
                              <button type="button" {...categoryDragProps(section)} className="menu-category-group__toggle" aria-expanded={childExpanded} aria-controls={`menu-unified-group-${section.id}`} disabled={Boolean(visualQuery)} onClick={() => setCollapsedCategoryIds((current) => { const next = new Set(current); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}>
                                <ChevronRight aria-hidden="true" /><span><strong>{section.name || tr('Untitled subcategory', 'Sottocategoria senza nome')}</strong><small>{section.description || tr('Subcategory', 'Sottocategoria')}</small></span><em>{items.length}</em>
                              </button>
                              {!section.visible && <span className="menu-category-group__status">{tr('Hidden', 'Nascosta')}</span>}
                              <button type="button" className="menu-category-group__edit" aria-label={tr(`Edit ${section.name}`, `Modifica ${section.name}`)} onClick={() => openCategoryEditor(section.id)}><Edit aria-hidden="true" />{tr('Edit', 'Modifica')}</button>
                            </div>
                            <div className="menu-unified-items" id={`menu-unified-group-${section.id}`} hidden={!childExpanded}>{items.map(renderItemRow)}</div>
                            {childExpanded && !visualQuery && <button type="button" className="menu-category-group__add" onClick={() => addItem(section.id)} disabled={maxItems !== null && draft.items.length >= maxItems}><Plus aria-hidden="true" />{tr('Add item', 'Aggiungi elemento')}</button>}
                          </section>;
                        })}
                        {!visualQuery && <div className="menu-unified-group-actions"><button type="button" className="menu-category-group__add" onClick={() => addItem(root.id)} disabled={maxItems !== null && draft.items.length >= maxItems}><Plus aria-hidden="true" />{tr('Add item', 'Aggiungi elemento')}</button><button type="button" className="menu-category-group__add" onClick={() => addSubsection(root.id)} disabled={draft.sections.length >= 30}><Plus aria-hidden="true" />{tr('Add subcategory', 'Aggiungi sottocategoria')}</button></div>}
                      </div>
                    </section>;
                  })}
                  {visualGroups.length === 0 && <div className="menu-category-empty"><Search aria-hidden="true" /><strong>{tr('No results found', 'Nessun risultato trovato')}</strong><span>{tr('Try another search or filter.', 'Prova un’altra ricerca o filtro.')}</span><Button variant="outline" size="sm" onClick={() => { setItemQuery(''); setProductSectionFilter('all'); setCategoryVisibility('all'); }}>{tr('Clear filters', 'Azzera filtri')}</Button></div>}
                </div>
              </div>
              <div className="menu-unified-side menu-content-pane--products">
                {visualEditor === 'category' && selectedSection && categoryEditorOpen ? renderCategoryEditor(selectedSection)
                  : visualEditor === 'item' ? itemEditor
                  : <div className="menu-category-editor-empty"><Layers3 aria-hidden="true" /><strong>{tr('Select a category or item', 'Seleziona una categoria o un elemento')}</strong><span>{tr('Its details will open here.', 'Qui si apriranno i dettagli.')}</span></div>}
              </div>
            </div>
          </div>}

          {presentation === 'classic' && <div className="menu-content-editor">
          <div className={`admin-panel menu-content-pane menu-content-pane--sections${mobileContentPane === 'sections' ? ' is-mobile-active' : ''}`}>
            <div className="menu-content-pane__header">
              <div className="menu-editor-section-title"><span>01</span><div><h3>{tr("Categories", "Categorie")}</h3><p>{tr("Build the structure visitors browse.", "Definisci la struttura che vedranno i visitatori.")}</p></div></div>
              <Button variant="outline" size="sm" onClick={addSection} disabled={draft.sections.length >= 30}><Plus className="h-4 w-4" />{presentation === 'visual' ? tr('Add category', 'Aggiungi categoria') : tr("Add", "Aggiungi")}</Button>
            </div>
            <div className="menu-content-pane__scroll menu-category-workspace">
              <div className={`menu-category-index${presentation === 'visual' ? ' menu-category-index--visual' : ''}`}>
                {presentation === 'visual' ? <div className="menu-category-list">
                  <div className="menu-category-toolbar">
                    <label className="menu-category-search">
                      <Search aria-hidden="true" />
                      <span className="sr-only">{tr('Search categories', 'Cerca categorie')}</span>
                      <Input type="search" value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder={tr('Search categories', 'Cerca categorie')} />
                    </label>
                    <select aria-label={tr('Filter category visibility', 'Filtra visibilità categorie')} value={categoryVisibility} onChange={(event) => setCategoryVisibility(event.target.value as typeof categoryVisibility)}>
                      <option value="all">{tr('All categories', 'Tutte le categorie')}</option>
                      <option value="visible">{tr('Visible', 'Visibili')}</option>
                      <option value="hidden">{tr('Hidden', 'Nascoste')}</option>
                    </select>
                  </div>
                  <div className="menu-category-groups" aria-label={tr('Menu categories', 'Categorie del menu')}>
                    {categoryGroups.map(({ root, children, itemCount }) => {
                      const expanded = Boolean(categorySearch) || !collapsedCategoryIds.has(root.id);
                      return <section className="menu-category-group" key={root.id}>
                        <div className="menu-category-group__heading">
                          <button type="button" className="menu-category-group__toggle" aria-expanded={expanded} aria-controls={`menu-category-group-${root.id}`} disabled={Boolean(categorySearch)} onClick={() => setCollapsedCategoryIds((current) => {
                            const next = new Set(current);
                            if (next.has(root.id)) next.delete(root.id); else next.add(root.id);
                            return next;
                          })}>
                            <ChevronRight aria-hidden="true" />
                            <span><strong>{root.name || tr('Untitled category', 'Categoria senza nome')}</strong><small>{root.description || tr('Main category', 'Categoria principale')}</small></span>
                            <em title={tr(`${itemCount} items`, `${itemCount} elementi`)}>{itemCount}</em>
                          </button>
                          {!root.visible && <span className="menu-category-group__status">{tr('Hidden', 'Nascosta')}</span>}
                          <button type="button" className="menu-category-group__edit" aria-label={tr(`Edit ${root.name}`, `Modifica ${root.name}`)} onClick={() => openCategoryEditor(root.id)}><Edit aria-hidden="true" />{tr('Edit', 'Modifica')}</button>
                        </div>
                        <div className="menu-category-group__body" id={`menu-category-group-${root.id}`} hidden={!expanded}>
                          {children.map((section) => {
                            const itemCount = draft.items.filter((item) => item.sectionId === section.id).length;
                            return <button type="button" key={section.id} {...categoryDragProps(section)} className={`menu-category-row${selectedCategoryId === section.id && categoryEditorOpen ? ' active' : ''}${draggedSectionId === section.id ? ' is-dragging' : ''}${dragOverId === `section:${section.id}` ? ' is-drag-over' : ''}`} aria-label={tr(`Edit ${section.name}`, `Modifica ${section.name}`)} onClick={() => openCategoryEditor(section.id)} title={tr('Drag to reorder at this level', 'Trascina per riordinare a questo livello')}>
                              <GripVertical className="menu-order-grip" aria-hidden="true" />
                              <span className="menu-category-row__copy"><strong>{section.name || tr('Untitled category', 'Sottocategoria senza nome')}</strong><small>{section.description || tr('Subcategory', 'Sottocategoria')}</small></span>
                              <span className="menu-category-row__count">{itemCount} {itemCount === 1 ? tr('item', 'elemento') : tr('items', 'elementi')}</span>
                              <span className="menu-category-row__icons">{!section.visible && <EyeOff aria-label={tr('Hidden', 'Nascosta')} />}<ChevronRight aria-hidden="true" /></span>
                            </button>;
                          })}
                          <button type="button" className="menu-category-group__add" onClick={() => addSubsection(root.id)} disabled={draft.sections.length >= 30}><Plus aria-hidden="true" />{tr('Add subcategory', 'Aggiungi sottocategoria')}</button>
                        </div>
                      </section>;
                    })}
                    {categoryGroups.length === 0 && <div className="menu-category-empty"><Search aria-hidden="true" /><strong>{tr('No categories found', 'Nessuna categoria trovata')}</strong><span>{tr('Try another search or visibility filter.', 'Prova un’altra ricerca o filtro di visibilità.')}</span></div>}
                  </div>
                </div> : <>
                <button
                  type="button"
                  className={`menu-section-filter${productSectionFilter === 'all' ? ' active' : ''}`}
                  onClick={() => {
                    setProductSectionFilter('all');
                    setMobileContentPane('products');
                  }}
                >
                  <span>{tr("All items", "Tutti gli elementi")}</span>
                  <strong>{draft.items.length}</strong>
                </button>
                <div className="menu-category-picker" aria-label={tr("Menu categories", "Categorie del menu")}>
                  {sortedSections.map((section) => {
                    const itemCount = draft.items.filter((item) => item.sectionId === section.id).length;
                    return (
                      <button
                        type="button"
                        key={section.id}
                        className={`menu-category-picker__item${section.parentId ? ' is-subcategory' : ''}${productSectionFilter === section.id ? ' active' : ''}${draggedSectionId === section.id ? ' is-dragging' : ''}${dragOverId === `section:${section.id}` ? ' is-drag-over' : ''}`}
                        aria-current={productSectionFilter === section.id ? 'true' : undefined}
                        aria-label={`${section.name || tr("Untitled category", "Categoria senza nome")} ${itemCount}`}
                        {...categoryDragProps(section)}
                        onClick={() => setProductSectionFilter(section.id)}
                        title={tr('Drag to reorder at this level', 'Trascina per riordinare a questo livello')}
                      >
                        <GripVertical className="menu-order-grip" aria-hidden="true" />
                        <span className="menu-category-picker__copy">
                          <small>{section.parentId ? tr('Subcategory', 'Sottocategoria') : tr('Category', 'Categoria')}</small>
                          <strong>{section.name || tr("Untitled category", "Categoria senza nome")}</strong>
                        </span>
                        <small className="menu-category-picker__meta">
                          {section.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                          <strong>{itemCount}</strong>
                          <span>{itemCount === 1 ? tr('item', 'elemento') : tr('items', 'elementi')}</span>
                        </small>
                      </button>
                    );
                  })}
                </div>
                </>}
                {selectedSection && categoryEditorOpen
                  ? renderCategoryEditor(selectedSection)
                  : presentation === 'visual' && <div className="menu-category-editor-empty"><Layers3 aria-hidden="true" /><strong>{tr('Select a category to edit', 'Seleziona una categoria da modificare')}</strong><span>{tr('Its name, visibility and order will appear here.', 'Qui potrai modificarne nome, visibilità e ordine.')}</span></div>}
              </div>
            </div>
          </div>

          <div className={`admin-panel menu-content-pane menu-content-pane--products${mobileContentPane === 'products' ? ' is-mobile-active' : ''}${mobileEditingItem ? ' is-item-editing' : ''}`}>
            <div className="menu-content-pane__header">
              <div className="menu-editor-section-title"><span>02</span><div><h3>{tr("Your items", "I tuoi elementi")}</h3><p>{tr("Manage what appears on your public menu.", "Gestisci cosa appare nel menu pubblico.")}</p></div></div>
              <Button size="sm" onClick={() => addItem()} disabled={draft.sections.length === 0 || (maxItems !== null && draft.items.length >= maxItems)}><Plus className="h-4 w-4" />{tr("Add item", "Aggiungi elemento")}</Button>
            </div>
            <div className="menu-product-toolbar">
              <label className="menu-product-search">
                <Search aria-hidden="true" />
                <span className="sr-only">{tr("Search menu items", "Cerca elementi del menu")}</span>
                <Input
                  type="search"
                  value={itemQuery}
                  onChange={(event) => setItemQuery(event.target.value)}
                  placeholder={tr("Search by name or details", "Cerca per nome o dettagli")}
                />
              </label>
              <div className="menu-product-filter">
                <Label htmlFor="menu-product-section">{tr("Show", "Mostra")}</Label>
                <select id="menu-product-section" value={productSectionFilter} onChange={(event) => { setProductSectionFilter(event.target.value); setMobileEditingItem(false); }}>
                  <option value="all">{tr(`All items (${draft.items.length})`, `Tutti gli elementi (${draft.items.length})`)}</option>
                  {sortedSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.parentId ? '↳ ' : ''}{section.name} ({draft.items.filter((item) => item.sectionId === section.id).length})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="menu-content-pane__scroll menu-item-workspace">
              <div className={`menu-items-workspace-grid${mobileEditingItem ? ' is-mobile-editing' : ''}`}>
                <div className="menu-item-list-column">
                  <div className="menu-item-list-heading">
                    <strong>{visibleProducts.length}</strong>
                    <span>{visibleProducts.length === 1 ? tr("item", "elemento") : tr("items", "elementi")}</span>
                    {!itemQuery && <small>{tr('Open an item to edit or change its order', 'Apri un elemento per modificarlo o riordinarlo')}</small>}
                  </div>
                  {visibleProducts.length > 0 && (
                    <div className="menu-item-picker" aria-label={tr("Items in selected category", "Elementi nella categoria selezionata")}>
                      {(presentation === 'visual' ? itemGroups : [{ section: null, items: visibleProducts, count: visibleProducts.length }]).map(({ section, items, count }) => {
                        const expanded = !section || Boolean(itemQuery) || !collapsedItemSectionIds.has(section.id);
                        const hiddenByParent = Boolean(section?.parentId && !itemQuery && collapsedItemSectionIds.has(section.parentId));
                        return <section key={section?.id || 'all'} className={`menu-item-group${section?.parentId ? ' is-subcategory' : ''}`} hidden={hiddenByParent}>
                          {section && <button type="button" className="menu-item-group__toggle" aria-expanded={expanded} aria-controls={`menu-item-group-${section.id}`} disabled={Boolean(itemQuery)} onClick={() => setCollapsedItemSectionIds((current) => {
                            const next = new Set(current);
                            if (next.has(section.id)) next.delete(section.id); else next.add(section.id);
                            return next;
                          })}>
                            <ChevronRight aria-hidden="true" /><strong>{section.name || tr('Untitled category', 'Categoria senza nome')}</strong><em>{count}</em>
                          </button>}
                          <div className="menu-item-group__body" id={section ? `menu-item-group-${section.id}` : undefined} hidden={!expanded}>
                            {items.map(renderItemRow)}
                          </div>
                        </section>;
                      })}
                    </div>
                  )}
                  {visibleProducts.length === 0 && <div className="menu-empty-products">
                    <UtensilsCrossed aria-hidden="true" />
                    <strong>{itemQuery ? tr('No matching items', 'Nessun elemento trovato') : tr('No items here yet', 'Ancora nessun elemento')}</strong>
                    <span>{itemQuery ? tr('Try another search or clear the filters.', 'Prova un’altra ricerca o azzera i filtri.') : tr('Add an item to start building this category.', 'Aggiungi un elemento per iniziare a comporre questa categoria.')}</span>
                    {draft.sections.length === 0
                      ? <Button variant="outline" size="sm" onClick={() => setMobileContentPane('sections')}>{tr('Create a category', 'Crea una categoria')}</Button>
                      : itemQuery || (productSectionFilter !== 'all' && draft.items.length > 0)
                      ? <Button variant="outline" size="sm" onClick={() => { setItemQuery(''); setProductSectionFilter('all'); }}>{tr('Clear filters', 'Azzera filtri')}</Button>
                      : <Button size="sm" onClick={() => addItem()} disabled={draft.sections.length === 0 || (maxItems !== null && draft.items.length >= maxItems)}><Plus className="h-4 w-4" />{tr('Add item', 'Aggiungi elemento')}</Button>}
                  </div>}
                </div>

                {itemEditor}
              </div>
            </div>
          </div>
          </div>}
        </section>}

        {activePanel === 'appearance' && <div className="menu-design-layout">
        <div className="menu-design-settings">
        <section className="admin-panel space-y-5">
          <div className="menu-editor-section-title"><Palette /><div><h3>{tr("Menu appearance", "Aspetto del menu")}</h3><p>{tr("Independent from the main OrbitPage theme.", "Indipendente dal tema principale OrbitPage.")}</p></div></div>
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
              <label><span>Corner radius</span><Input type="number" min="0" max="28" value={draft.theme.radius} onChange={(e) => update((current) => ({ ...current, theme: { ...current.theme, radius: Number(e.target.value) } }))} /></label>
            </div>
          ) : <p className="menu-plan-note">Starter includes curated menu themes. Fine-tuned colors and layout unlock on Pro.</p>}
        </section>

        </div>
        {designPreview && <aside className="menu-design-preview" aria-label={tr('Live mobile menu preview', 'Anteprima live del menu mobile')}>
          <strong>{tr('Mobile preview', 'Anteprima mobile')}</strong>
          {designPreview}
        </aside>}
        </div>}
      </div>
      {typeof document !== 'undefined' && (isDirty || saving || savedNotice) ? createPortal(
        <div className="admin-profile-save-layer">
          {(isDirty || saving) && (
            <div className="admin-profile-save-float">
              {saveError && <span className="max-w-72 text-xs text-red-700" role="alert">{saveError}</span>}
              <Button type="button" variant="outline" size="sm" onClick={revertUnsavedChanges} disabled={saving}>
                <RotateCcw className="h-4 w-4" /> {tr('Revert', 'Ripristina')}
              </Button>
              <Button type="button" size="sm" onClick={() => void save()} disabled={!isDirty || saving}>
                {saving ? <OrbitLoader size={16} state="composing" /> : <Save className="h-4 w-4" />}
                {saving ? tr('Saving', 'Salvataggio') : tr('Save', 'Salva')}
              </Button>
            </div>
          )}
          {savedNotice && (
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
