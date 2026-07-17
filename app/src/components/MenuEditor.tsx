import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowDown, ArrowUp, Check, Copy, ExternalLink, ImagePlus, Loader2, Palette,
  Plus, QrCode, Save, Trash2, UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MenuView } from '@/components/MenuView';
import { optimizeImageForUpload } from '@/lib/image-upload';
import { uploadApi } from '@/lib/api-client';
import {
  MENU_THEME_PRESETS, createDefaultMenu, normalizeMenuCatalog,
  type MenuCatalog, type MenuItem, type MenuThemePreset, type MenuVenueType,
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

function TagsInput({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
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
  const menuUrl = `${publicPageHref.replace(/\/$/, '')}/menu`;

  useEffect(() => {
    const normalized = normalizeMenuCatalog(menu, maxItems ?? 250);
    setDraft(normalized);
    onPreview(normalized);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, maxItems]);

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
    setSaving(true);
    setMessage('');
    try {
      const normalized = normalizeMenuCatalog(draft, maxItems ?? 250);
      await onSave(normalized);
      setDraft(normalized);
      onPreview(normalized);
      setMessage('Menu saved and queued for publication');
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
    update((current) => ({
      ...current,
      sections: [...current.sections, { id: makeId('section'), name: 'New section', visible: true, position: current.sections.length }],
    }));
  };

  const addItem = (sectionId = draft.sections[0]?.id) => {
    if (!sectionId || (maxItems !== null && draft.items.length >= maxItems)) return;
    update((current) => ({
      ...current,
      items: [...current.items, {
        id: makeId('item'), sectionId, name: 'New item', description: '', priceMinor: 0,
        variants: [], allergens: [], dietaryTags: [], available: true, featured: false, position: current.items.length,
      }],
    }));
  };

  const sortedSections = useMemo(() => [...draft.sections].sort((a, b) => a.position - b.position), [draft.sections]);

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
    <div className="menu-editor-layout">
      <div className="menu-editor-main space-y-5">
        <section className="admin-panel menu-editor-intro">
          <div>
            <p className="admin-eyebrow">{planName || 'Self-hosted'} menu</p>
            <h2>{tr("Venue menu", "Menu del locale")}</h2>
            <span>{draft.items.length}/{maxItems ?? '∞'} products</span>
          </div>
          <div className="menu-editor-intro__actions">
            <label className="menu-publish-toggle">
              <span>{tr("Published", "Pubblicato")}</span>
              <Switch checked={draft.enabled} onCheckedChange={(checked) => update((current) => ({ ...current, enabled: checked }))} />
            </label>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin-slow" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving' : 'Save menu'}
            </Button>
          </div>
          {message && <p className="menu-editor-message" aria-live="polite">{message}</p>}
        </section>

        <section className="admin-panel space-y-5">
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
        </section>

        <section className="admin-panel space-y-5">
          <div className="menu-editor-section-title"><div><h3>{tr("Sections", "Sezioni")}</h3><p>{tr("Organize products into concise, scannable groups.", "Organizza i prodotti in gruppi brevi e facili da consultare.")}</p></div><Button variant="outline" size="sm" onClick={addSection}><Plus className="h-4 w-4" />{tr("Add", "Aggiungi")}</Button></div>
          <div className="menu-section-list">
            {sortedSections.map((section, index) => (
              <div key={section.id} className="menu-section-row">
                <div className="menu-reorder-actions">
                  <button type="button" title="Move up" onClick={() => update((current) => ({ ...current, sections: move(sortedSections, index, -1).map((item, position) => ({ ...item, position })) }))}><ArrowUp /></button>
                  <button type="button" title="Move down" onClick={() => update((current) => ({ ...current, sections: move(sortedSections, index, 1).map((item, position) => ({ ...item, position })) }))}><ArrowDown /></button>
                </div>
                <div className="min-w-0 space-y-2">
                  <Input value={section.name} aria-label="Section name" onChange={(e) => update((current) => ({ ...current, sections: current.sections.map((item) => item.id === section.id ? { ...item, name: e.target.value } : item) }))} />
                  <Input value={section.description || ''} aria-label="Section description" placeholder="Optional description" onChange={(e) => update((current) => ({ ...current, sections: current.sections.map((item) => item.id === section.id ? { ...item, description: e.target.value } : item) }))} />
                </div>
                <Switch checked={section.visible} aria-label="Show section" onCheckedChange={(checked) => update((current) => ({ ...current, sections: current.sections.map((item) => item.id === section.id ? { ...item, visible: checked } : item) }))} />
                <Button variant="ghost" size="icon" title="Delete section" disabled={draft.sections.length === 1} onClick={() => update((current) => ({
                  ...current,
                  sections: current.sections.filter((item) => item.id !== section.id).map((item, position) => ({ ...item, position })),
                  items: current.items.filter((item) => item.sectionId !== section.id),
                }))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel space-y-5">
          <div className="menu-editor-section-title"><div><h3>{tr("Products", "Prodotti")}</h3><p>{tr("Prices are stored in cents to avoid rounding errors.", "I prezzi sono salvati in centesimi per evitare errori di arrotondamento.")}</p></div><Button variant="outline" size="sm" onClick={() => addItem()} disabled={maxItems !== null && draft.items.length >= maxItems}><Plus className="h-4 w-4" />{tr("Product", "Prodotto")}</Button></div>
          <div className="menu-product-list">
            {draft.items.map((item) => (
              <article key={item.id} className="menu-product-editor">
                <div className="menu-product-editor__top">
                  <label className="menu-product-image" title="Upload product image">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : uploadingItem === item.id ? <Loader2 className="animate-spin-slow" /> : <ImagePlus />}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void uploadItemImage(item.id, event.target.files?.[0])} />
                  </label>
                  <div className="min-w-0 grid flex-1 gap-3 md:grid-cols-[1fr_9rem]">
                    <div className="space-y-2"><Label>Name</Label><Input value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Price</Label><Input type="number" min="0" step="0.01" value={(item.priceMinor / 100).toFixed(2)} onChange={(e) => updateItem(item.id, { priceMinor: Math.max(0, Math.round(Number(e.target.value) * 100)) })} /></div>
                  </div>
                  <Button variant="ghost" size="icon" title="Delete product" onClick={() => update((current) => ({ ...current, items: current.items.filter((candidate) => candidate.id !== item.id).map((candidate, position) => ({ ...candidate, position })) }))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><Label>Description</Label><Textarea value={item.description || ''} onChange={(e) => updateItem(item.id, { description: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Section</Label><select value={item.sectionId} onChange={(e) => updateItem(item.id, { sectionId: e.target.value })}>{sortedSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></div>
                  <div className="space-y-2"><Label>Details</Label><Input placeholder="250 ml, 12% vol, seasonal" value={item.details || ''} onChange={(e) => updateItem(item.id, { details: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Dietary tags</Label><TagsInput value={item.dietaryTags} onChange={(dietaryTags) => updateItem(item.id, { dietaryTags })} placeholder="Vegan, vegetarian" /></div>
                  <div className="space-y-2"><Label>Allergens</Label><TagsInput value={item.allergens} onChange={(allergens) => updateItem(item.id, { allergens })} placeholder="Gluten, milk, nuts" /></div>
                </div>
                <div className="menu-variants-editor">
                  <div className="menu-variants-editor__heading">
                    <div><strong>Sizes and options</strong><span>Useful for glass/bottle, small/large or tasting portions.</span></div>
                    <Button type="button" variant="outline" size="sm" disabled={item.variants.length >= 8} onClick={() => addVariant(item)}><Plus className="h-4 w-4" />Option</Button>
                  </div>
                  {item.variants.map((variant) => (
                    <div key={variant.id} className="menu-variant-row">
                      <Input aria-label="Option name" placeholder="Glass, bottle, large" value={variant.name} onChange={(event) => updateItem(item.id, {
                        variants: item.variants.map((candidate) => candidate.id === variant.id ? { ...candidate, name: event.target.value } : candidate),
                      })} />
                      <div className="menu-variant-price"><span>{draft.currency}</span><Input aria-label="Option price" type="number" min="0" step="0.01" value={(variant.priceMinor / 100).toFixed(2)} onChange={(event) => updateItem(item.id, {
                        variants: item.variants.map((candidate) => candidate.id === variant.id ? { ...candidate, priceMinor: Math.max(0, Math.round(Number(event.target.value) * 100)) } : candidate),
                      })} /></div>
                      <Button type="button" variant="ghost" size="icon" title="Delete option" onClick={() => updateItem(item.id, { variants: item.variants.filter((candidate) => candidate.id !== variant.id) })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
                <div className="menu-product-flags">
                  <label><Switch checked={item.available} onCheckedChange={(available) => updateItem(item.id, { available })} /><span>Available</span></label>
                  <label><Switch checked={item.featured} onCheckedChange={(featured) => updateItem(item.id, { featured })} /><span>Featured</span></label>
                  {item.imageUrl && <button type="button" onClick={() => updateItem(item.id, { imageUrl: undefined, imageAlt: undefined })}>Remove image</button>}
                </div>
              </article>
            ))}
            {draft.items.length === 0 && <button type="button" className="menu-empty-products" onClick={() => addItem()}><Plus /><span>{tr("Add the first product", "Aggiungi il primo prodotto")}</span></button>}
          </div>
        </section>

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
      </div>

      <aside className="menu-editor-preview">
        <div className="menu-editor-preview__label"><span>{tr("Menu preview", "Anteprima menu")}</span><small>{tr("Updates before saving", "Si aggiorna prima del salvataggio")}</small></div>
        <div className="menu-editor-preview__device"><div className="menu-editor-preview__island" /><div className="menu-editor-preview__screen"><MenuView menu={draft} embedded pageHref="#" /></div></div>
      </aside>
    </div>
  );
}
