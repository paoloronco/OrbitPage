import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowDown, ArrowUp, Check, ChevronRight, Copy, ExternalLink, Eye, EyeOff,
  ImagePlus, Layers3, ListTree, Loader2, Palette, Plus, QrCode, Save, Trash2,
  Search, UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { optimizeImageForUpload } from '@/lib/image-upload';
import { uploadApi } from '@/lib/api-client';
import {
  MENU_THEME_PRESETS, createDefaultMenu, formatMenuPriceInput, normalizeMenuCatalog, parseMenuPriceInput,
  type MenuCatalog, type MenuItem, type MenuSection, type MenuThemePreset, type MenuVenueType,
} from '@/lib/menu';
import { useAppI18n } from '@/lib/i18n';

interface MenuEditorProps {
  menu: MenuCatalog;
  publicPageHref: string;
  enabled: boolean;
  maxItems: number | null;
  planName?: string;
  advancedTheme: boolean;
  onSave: (menu: MenuCatalog) => Promise<void>;
  onPreview: (menu: MenuCatalog) => void;
  onAddMenuLink: () => Promise<void>;
}

type MenuEditorPanel = 'setup' | 'content' | 'appearance';
type MenuContentPane = 'sections' | 'products';

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function sectionSiblings(sections: MenuSection[], parentId?: string) {
  return sections
    .filter((section) => section.parentId === parentId)
    .sort((a, b) => a.position - b.position);
}

function orderedSectionTree(sections: MenuSection[]) {
  return sectionSiblings(sections).flatMap((section) => [section, ...sectionSiblings(sections, section.id)]);
}

function menuFingerprint(menu: MenuCatalog) {
  return JSON.stringify({ ...menu, updatedAt: undefined });
}

function moveMenuSection(sections: MenuSection[], sectionId: string, direction: -1 | 1) {
  const selected = sections.find((section) => section.id === sectionId);
  if (!selected) return sections;
  const siblings = sectionSiblings(sections, selected.parentId);
  const index = siblings.findIndex((section) => section.id === sectionId);
  const reorderedSiblings = move(siblings, index, direction);
  if (reorderedSiblings === siblings) return sections;
  const siblingPositions = new Map(reorderedSiblings.map((section, position) => [section.id, position]));
  const updated = sections.map((section) => siblingPositions.has(section.id)
    ? { ...section, position: siblingPositions.get(section.id)! }
    : section);
  return orderedSectionTree(updated).map((section, position) => ({ ...section, position }));
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
  menu, publicPageHref, enabled, maxItems, planName, advancedTheme,
  onSave, onPreview, onAddMenuLink,
}: MenuEditorProps) {
  const { tr } = useAppI18n();
  const [draft, setDraft] = useState(() => normalizeMenuCatalog(menu, maxItems ?? 250));
  const [saving, setSaving] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<MenuEditorPanel>('content');
  const [mobileContentPane, setMobileContentPane] = useState<MenuContentPane>('sections');
  const [itemQuery, setItemQuery] = useState('');
  const [productSectionFilter, setProductSectionFilter] = useState(
    () => normalizeMenuCatalog(menu, maxItems ?? 250).sections[0]?.id || 'all',
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => normalizeMenuCatalog(menu, maxItems ?? 250).items[0]?.id || null,
  );
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
    () => draft.sections.find((section) => section.id === productSectionFilter) || null,
    [draft.sections, productSectionFilter],
  );
  const selectedItem = useMemo(
    () => visibleProducts.find((item) => item.id === selectedItemId) || null,
    [selectedItemId, visibleProducts],
  );

  useEffect(() => {
    const normalized = normalizeMenuCatalog(menu, maxItems ?? 250);
    setDraft(normalized);
    onPreview(normalized);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, maxItems]);

  useEffect(() => {
    if (productSectionFilter !== 'all' && !draft.sections.some((section) => section.id === productSectionFilter)) {
      setProductSectionFilter('all');
    }
  }, [draft.sections, productSectionFilter]);

  useEffect(() => {
    if (!visibleProducts.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(visibleProducts[0]?.id || null);
    }
  }, [selectedItemId, visibleProducts]);

  const update = (producer: (current: MenuCatalog) => MenuCatalog) => {
    setDraft((current) => {
      const next = normalizeMenuCatalog(
        { ...producer(current), updatedAt: new Date().toISOString() },
        maxItems ?? 250,
        { preserveTextEdges: true },
      );
      onPreview(next);
      return next;
    });
    setMessage(tr('Unsaved changes', 'Modifiche non salvate'));
  };

  const save = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const normalized = normalizeMenuCatalog(draft, maxItems ?? 250);
      await onSave(normalized);
      setDraft(normalized);
      onPreview(normalized);
      setMessage(tr('Menu saved and published', 'Menu salvato e pubblicato'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Menu could not be saved');
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
    setProductSectionFilter(id);
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
    setProductSectionFilter(id);
  };

  const removeSection = (sectionId: string) => {
    const fallbackSection = sortedSections.find((section) => section.id !== sectionId && section.parentId !== sectionId);
    setProductSectionFilter(fallbackSection?.id || 'all');
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
    setProductSectionFilter(sectionId);
    setSelectedItemId(id);
    setMobileContentPane('products');
  };

  const removeItem = (itemId: string) => {
    const remaining = visibleProducts.filter((candidate) => candidate.id !== itemId);
    setSelectedItemId(remaining[0]?.id || null);
    update((current) => ({
      ...current,
      items: current.items
        .filter((candidate) => candidate.id !== itemId)
        .map((candidate, position) => ({ ...candidate, position })),
    }));
  };

  const rootSections = useMemo(() => sectionSiblings(draft.sections), [draft.sections]);
  const sortedSections = useMemo(() => orderedSectionTree(draft.sections), [draft.sections]);

  const renderCategoryEditor = (section: MenuSection) => {
    const siblings = sectionSiblings(draft.sections, section.parentId);
    const sectionIndex = siblings.findIndex((candidate) => candidate.id === section.id);
    const nested = Boolean(section.parentId);
    const canDelete = nested || rootSections.length > 1;
    return (
      <div className="menu-category-accordion__body">
        <div className="menu-category-accordion__body-inner">
          <section className="menu-category-editor" aria-label={tr("Selected category", "Categoria selezionata")}>
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
              onClick={() => setMobileContentPane('products')}
            >
              <ListTree className="h-4 w-4" />
              {tr("Manage items in this category", "Gestisci gli elementi di questa categoria")}
              <strong>{draft.items.filter((item) => item.sectionId === section.id).length}</strong>
            </Button>
          </section>
        </div>
      </div>
    );
  };

  if (!enabled) {
    return (
      <section className="admin-panel menu-upgrade-panel">
        <div className="menu-upgrade-panel__icon"><UtensilsCrossed /></div>
        <p>OrbitPage Menu</p>
        <h2>{tr("Turn the page into a complete venue destination.", "Trasforma la pagina in una destinazione completa per il tuo locale.")}</h2>
        <div>{tr("Free can link an external menu. Starter adds a native, editable menu with categories, products, themes and a QR-ready public URL.", "Free può collegare un menu esterno. Starter aggiunge un menu nativo modificabile con categorie, prodotti, temi e un URL pubblico pronto per il QR.")}</div>
        <a href="/dashboard/billing" target="_top"><Button>{tr("View Starter and Pro", "Vedi Starter e Pro")}</Button></a>
      </section>
    );
  }

  return (
    <div className="menu-editor-stack">
      <div className="menu-editor-main space-y-5">
        <section className="admin-panel menu-editor-intro">
          <div className="menu-editor-intro__identity">
            <p className="admin-eyebrow">{planName || 'Self-hosted'} menu</p>
            <h2>{tr("Venue menu", "Menu del locale")}</h2>
            <div className="menu-editor-summary" aria-label={tr("Menu summary", "Riepilogo menu")}>
              <span><strong>{draft.sections.length}</strong>{tr("categories", "categorie")}</span>
              <span><strong>{draft.items.length}</strong>{tr("items", "elementi")}</span>
              <span><strong>{draft.items.filter((item) => item.available).length}</strong>{tr("available", "disponibili")}</span>
            </div>
          </div>
          <div className="menu-editor-intro__actions">
            <label className="menu-publish-toggle">
              <span><strong>{draft.enabled ? tr("Published", "Pubblicato") : tr("Draft", "Bozza")}</strong><small>{tr("Public menu visibility", "Visibilità del menu pubblico")}</small></span>
              <Switch checked={draft.enabled} onCheckedChange={(checked) => update((current) => ({ ...current, enabled: checked }))} />
            </label>
            <Button onClick={() => void save()} disabled={!isDirty || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin-slow" /> : <Save className="h-4 w-4" />}
              {saving ? tr('Saving', 'Salvataggio') : tr('Save menu', 'Salva menu')}
            </Button>
          </div>
          {message && <p className={`menu-editor-message${isDirty ? ' is-pending' : ' is-saved'}`} aria-live="polite">{message}</p>}
        </section>

        <nav className="menu-editor-tabs" aria-label={tr('Menu editor sections', 'Sezioni editor menu')}>
          {([
            ['setup', UtensilsCrossed, tr('Setup', 'Impostazioni')],
            ['content', Layers3, tr('Menu content', 'Contenuti menu')],
            ['appearance', Palette, tr('Appearance', 'Aspetto')],
          ] as const).map(([panel, Icon, label]) => (
            <button
              key={panel}
              type="button"
              className={activePanel === panel ? 'active' : ''}
              aria-current={activePanel === panel ? 'page' : undefined}
              onClick={() => setActivePanel(panel)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {activePanel === 'setup' && <section className="admin-panel space-y-5">
          <div className="menu-editor-section-title"><UtensilsCrossed /><div><h3>{tr("Menu identity", "Identità del menu")}</h3><p>{tr("Choose the venue type and public heading.", "Scegli il tipo di locale e l'intestazione pubblica.")}</p></div></div>
          <div className="menu-venue-switch" role="group" aria-label={tr("Venue type", "Tipo di locale")}>
            {(['restaurant', 'bar', 'cafe'] as const).map((type) => (
              <button key={type} type="button" className={draft.venueType === type ? 'active' : ''} onClick={() => changeVenueType(type)}>
                {type === 'cafe' ? 'Café' : type[0].toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="menu-name">{tr("Menu name", "Nome menu")}</Label><Input id="menu-name" value={draft.name} onChange={(e) => update((current) => ({ ...current, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="menu-currency">Currency</Label><Input id="menu-currency" maxLength={3} value={draft.currency} onChange={(e) => update((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} /></div>
              <div className="space-y-2"><Label htmlFor="menu-locale">Locale</Label><Input id="menu-locale" value={draft.locale} onChange={(e) => update((current) => ({ ...current, locale: e.target.value }))} /></div>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="menu-description">{tr("Introduction", "Introduzione")}</Label><Textarea id="menu-description" value={draft.description} onChange={(e) => update((current) => ({ ...current, description: e.target.value }))} /></div>
        </section>}

        {activePanel === 'content' && <section className="menu-content-editor">
          <div className="menu-content-mobile-switch" role="group" aria-label={tr("Menu content view", "Vista contenuti menu")}>
            <button type="button" className={mobileContentPane === 'sections' ? 'active' : ''} onClick={() => setMobileContentPane('sections')}><Layers3 />{tr("Categories", "Categorie")}</button>
            <button type="button" className={mobileContentPane === 'products' ? 'active' : ''} onClick={() => setMobileContentPane('products')}><ListTree />{tr("Items", "Elementi")}</button>
          </div>

          <div className={`admin-panel menu-content-pane menu-content-pane--sections${mobileContentPane === 'sections' ? ' is-mobile-active' : ''}`}>
            <div className="menu-content-pane__header">
              <div className="menu-editor-section-title"><span>01</span><div><h3>{tr("Categories", "Categorie")}</h3><p>{tr("Build the structure visitors browse.", "Definisci la struttura che vedranno i visitatori.")}</p></div></div>
              <Button variant="outline" size="sm" onClick={addSection} disabled={draft.sections.length >= 30}><Plus className="h-4 w-4" />{tr("Add", "Aggiungi")}</Button>
            </div>
            <div className="menu-content-pane__scroll menu-category-workspace">
              <div className="menu-category-index">
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
                    const expanded = productSectionFilter === section.id;
                    return (
                      <div
                        key={section.id}
                        className={`menu-category-accordion${section.parentId ? ' is-subcategory' : ''}${expanded ? ' is-expanded' : ''}`}
                      >
                        <button
                          type="button"
                          className={`menu-category-picker__item${expanded ? ' active' : ''}`}
                          aria-expanded={expanded}
                          aria-controls={`menu-category-editor-${section.id}`}
                          onClick={() => setProductSectionFilter(section.id)}
                        >
                          <span>{section.name || tr("Untitled category", "Categoria senza nome")}</span>
                          <small>{section.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}{itemCount}</small>
                          <ChevronRight aria-hidden="true" />
                        </button>
                        {expanded && (
                          <div id={`menu-category-editor-${section.id}`}>
                            {renderCategoryEditor(section)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className={`admin-panel menu-content-pane menu-content-pane--products${mobileContentPane === 'products' ? ' is-mobile-active' : ''}`}>
            <div className="menu-content-pane__header">
              <div className="menu-editor-section-title"><span>02</span><div><h3>{tr("Items", "Elementi")}</h3><p>{selectedSection ? selectedSection.name : tr("Every category", "Tutte le categorie")}</p></div></div>
              <Button size="sm" onClick={() => addItem()} disabled={maxItems !== null && draft.items.length >= maxItems}><Plus className="h-4 w-4" />{tr("New item", "Nuovo elemento")}</Button>
            </div>
            <div className="menu-product-toolbar">
              <div className="menu-product-filter">
                <Label htmlFor="menu-product-section">{tr("Category", "Categoria")}</Label>
                <select id="menu-product-section" value={productSectionFilter} onChange={(event) => setProductSectionFilter(event.target.value)}>
                  <option value="all">{tr(`All items (${draft.items.length})`, `Tutti gli elementi (${draft.items.length})`)}</option>
                  {sortedSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.parentId ? '↳ ' : ''}{section.name} ({draft.items.filter((item) => item.sectionId === section.id).length})
                    </option>
                  ))}
                </select>
              </div>
              <label className="menu-product-search">
                <Search aria-hidden="true" />
                <span className="sr-only">{tr("Search menu items", "Cerca elementi del menu")}</span>
                <Input
                  type="search"
                  value={itemQuery}
                  onChange={(event) => setItemQuery(event.target.value)}
                  placeholder={tr("Search items", "Cerca elementi")}
                />
              </label>
            </div>
            <div className="menu-content-pane__scroll menu-item-workspace">
              <div className="menu-items-workspace-grid">
                <div className="menu-item-list-column">
                  <div className="menu-item-list-heading">
                    <strong>{visibleProducts.length}</strong>
                    <span>{visibleProducts.length === 1 ? tr("item", "elemento") : tr("items", "elementi")}</span>
                  </div>
                  {visibleProducts.length > 0 && (
                    <div className="menu-item-picker" aria-label={tr("Items in selected category", "Elementi nella categoria selezionata")}>
                      {visibleProducts.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`menu-item-picker__item${selectedItemId === item.id ? ' active' : ''}`}
                          aria-pressed={selectedItemId === item.id}
                          onClick={() => setSelectedItemId(item.id)}
                        >
                          <span className="menu-item-picker__thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <UtensilsCrossed aria-hidden="true" />}</span>
                          <span><strong>{item.name || tr("Untitled item", "Elemento senza nome")}</strong><small>{formatMenuPriceInput(item.priceMinor, draft.locale)} {draft.currency}</small></span>
                          <em className={item.available ? 'available' : ''}>{item.available ? tr("Available", "Disponibile") : tr("Hidden", "Nascosto")}</em>
                          <ChevronRight aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                  {visibleProducts.length === 0 && (
                    <button type="button" className="menu-empty-products" onClick={() => addItem()}>
                      <Plus /><span>{itemQuery ? tr("No matching items. Create one.", "Nessun risultato. Crea un elemento.") : tr("Add the first item in this section", "Aggiungi il primo elemento in questa sezione")}</span>
                    </button>
                  )}
                </div>

                {selectedItem ? (
                  <article key={selectedItem.id} className="menu-product-editor">
                    <div className="menu-product-editor__heading">
                      <div>
                        <span>{tr("Selected item", "Elemento selezionato")}</span>
                        <strong>{selectedItem.name || tr("Untitled item", "Elemento senza nome")}</strong>
                      </div>
                      <Button variant="ghost" size="icon" title={tr("Delete item", "Elimina elemento")} onClick={() => removeItem(selectedItem.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                <div className="menu-product-editor__top">
                  <label className="menu-product-image" title="Upload product image">
                    {selectedItem.imageUrl ? <img src={selectedItem.imageUrl} alt="" /> : uploadingItem === selectedItem.id ? <Loader2 className="animate-spin-slow" /> : <ImagePlus />}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void uploadItemImage(selectedItem.id, event.target.files?.[0])} />
                  </label>
                  <div className="min-w-0 grid flex-1 gap-3 md:grid-cols-[1fr_9rem]">
                    <div className="space-y-2"><Label htmlFor={`menu-item-name-${selectedItem.id}`}>{tr("Name", "Nome")}</Label><Input id={`menu-item-name-${selectedItem.id}`} value={selectedItem.name} onChange={(e) => updateItem(selectedItem.id, { name: e.target.value })} /></div>
                    <div className="space-y-2"><Label>{tr("Price", "Prezzo")}</Label><PriceInput value={selectedItem.priceMinor} locale={draft.locale} label="Product price" onChange={(priceMinor) => updateItem(selectedItem.id, { priceMinor })} /></div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><Label htmlFor={`menu-item-description-${selectedItem.id}`}>{tr("Description", "Descrizione")}</Label><Textarea id={`menu-item-description-${selectedItem.id}`} value={selectedItem.description || ''} onChange={(e) => updateItem(selectedItem.id, { description: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor={`menu-item-section-${selectedItem.id}`}>{tr("Section", "Sezione")}</Label><select id={`menu-item-section-${selectedItem.id}`} value={selectedItem.sectionId} onChange={(e) => updateItem(selectedItem.id, { sectionId: e.target.value })}>{rootSections.map((section) => <optgroup key={section.id} label={section.name}><option value={section.id}>{section.name}</option>{sectionSiblings(sortedSections, section.id).map((subsection) => <option key={subsection.id} value={subsection.id}>↳ {subsection.name}</option>)}</optgroup>)}</select></div>
                  <div className="space-y-2"><Label htmlFor={`menu-item-details-${selectedItem.id}`}>{tr("Details", "Dettagli")}</Label><Input id={`menu-item-details-${selectedItem.id}`} placeholder="250 ml, 12% vol, seasonal" value={selectedItem.details || ''} onChange={(e) => updateItem(selectedItem.id, { details: e.target.value })} /></div>
                  <div className="space-y-2"><Label>{tr("Dietary tags", "Indicazioni alimentari")}</Label><TagsInput label="Dietary tags" value={selectedItem.dietaryTags} onChange={(dietaryTags) => updateItem(selectedItem.id, { dietaryTags })} placeholder="Vegan, vegetarian" /></div>
                  <div className="space-y-2"><Label>{tr("Allergens", "Allergeni")}</Label><TagsInput label="Allergens" value={selectedItem.allergens} onChange={(allergens) => updateItem(selectedItem.id, { allergens })} placeholder="Gluten, milk, nuts" /></div>
                </div>
                <div className="menu-variants-editor">
                  <div className="menu-variants-editor__heading">
                    <div><strong>{tr("Sizes and options", "Formati e opzioni")}</strong><span>{tr("Glass or bottle, small or large, and tasting portions.", "Calice o bottiglia, piccolo o grande e porzioni degustazione.")}</span></div>
                    <Button type="button" variant="outline" size="sm" disabled={selectedItem.variants.length >= 8} onClick={() => addVariant(selectedItem)}><Plus className="h-4 w-4" />{tr("Option", "Opzione")}</Button>
                  </div>
                  {selectedItem.variants.map((variant) => (
                    <div key={variant.id} className="menu-variant-row">
                      <Input aria-label="Option name" placeholder="Glass, bottle, large" value={variant.name} onChange={(event) => updateItem(selectedItem.id, {
                        variants: selectedItem.variants.map((candidate) => candidate.id === variant.id ? { ...candidate, name: event.target.value } : candidate),
                      })} />
                      <div className="menu-variant-price"><span>{draft.currency}</span><PriceInput value={variant.priceMinor} locale={draft.locale} label="Option price" onChange={(priceMinor) => updateItem(selectedItem.id, {
                        variants: selectedItem.variants.map((candidate) => candidate.id === variant.id ? { ...candidate, priceMinor } : candidate),
                      })} /></div>
                      <Button type="button" variant="ghost" size="icon" title="Delete option" onClick={() => updateItem(selectedItem.id, { variants: selectedItem.variants.filter((candidate) => candidate.id !== variant.id) })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <div className="menu-product-flags">
                  <label><Switch checked={selectedItem.available} onCheckedChange={(available) => updateItem(selectedItem.id, { available })} /><span>{tr("Available", "Disponibile")}</span></label>
                  <label><Switch checked={selectedItem.featured} onCheckedChange={(featured) => updateItem(selectedItem.id, { featured })} /><span>{tr("Featured", "In evidenza")}</span></label>
                  {selectedItem.imageUrl && <button type="button" className="menu-remove-image-action" onClick={() => updateItem(selectedItem.id, { imageUrl: undefined, imageAlt: undefined })}>{tr("Remove image", "Rimuovi immagine")}</button>}
                </div>
                  </article>
                ) : (
                  <div className="menu-product-editor-empty">
                    <UtensilsCrossed aria-hidden="true" />
                    <strong>{tr("Select an item to edit", "Seleziona un elemento da modificare")}</strong>
                    <span>{tr("Its content, price and availability will appear here.", "Qui compariranno contenuto, prezzo e disponibilità.")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>}

        {activePanel === 'appearance' && <>
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
              {(['background', 'surface', 'text', 'muted', 'accent', 'border'] as const).map((key) => <label key={key}><span>{key}</span><Input type="color" value={draft.theme[key]} onChange={(e) => update((current) => ({ ...current, theme: { ...current.theme, [key]: e.target.value } }))} /></label>)}
              <label><span>Corner radius</span><Input type="number" min="0" max="28" value={draft.theme.radius} onChange={(e) => update((current) => ({ ...current, theme: { ...current.theme, radius: Number(e.target.value) } }))} /></label>
            </div>
          ) : <p className="menu-plan-note">Starter includes curated menu themes. Fine-tuned colors and layout unlock on Pro.</p>}
        </section>

        <section className="admin-panel menu-publish-tools">
          <div className="menu-editor-section-title"><QrCode /><div><h3>{tr("Public menu", "Menu pubblico")}</h3><p>{tr("The URL is static, cacheable and ready for print.", "L'URL è statico, memorizzabile in cache e pronto per la stampa.")}</p></div></div>
          <div className="menu-publish-tools__grid">
            <MenuQr url={menuUrl} color={draft.theme.text} />
            <div>
              <Label>URL menu</Label>
              <div className="menu-url-row"><Input value={menuUrl} readOnly /><Button variant="outline" size="icon" title="Copy URL" onClick={() => { void navigator.clipboard.writeText(menuUrl); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Check /> : <Copy />}</Button><a href={menuUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="icon" title="Open menu"><ExternalLink /></Button></a></div>
              <Button className="mt-4" variant="outline" onClick={() => void onAddMenuLink()}>{tr("Add menu link to main page", "Aggiungi il link al menu nella pagina principale")}</Button>
            </div>
          </div>
        </section>
        </>}
      </div>
    </div>
  );
}
