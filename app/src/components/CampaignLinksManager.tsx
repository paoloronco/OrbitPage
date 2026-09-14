import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Plus, Save, Trash2 } from 'lucide-react';
import type { OrbitPageCampaignLink, OrbitPageCampaignRule } from '@orbitpage/page-schema';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { campaignLinksApi, type SubpageItem } from '@/lib/api-client';
import type { MenuCatalog } from '@/lib/menu';
import { useAppI18n } from '@/lib/i18n';

const defaultTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const cleanSlug = (value: string) => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

function menuDestination(menu: MenuCatalog, pattern: RegExp) {
  const section = menu.sections.find((candidate) => !candidate.parentId && candidate.visible && pattern.test(candidate.name));
  return section ? `menu?section=${section.id}` : 'menu';
}

export function CampaignLinksManager({
  menu,
  readOnly,
  selectedSlug,
  onSelect,
  onBaseUrl,
  subpages,
}: {
  menu: MenuCatalog;
  readOnly: boolean;
  selectedSlug: string;
  onSelect: (slug: string) => void;
  onBaseUrl: (url: string) => void;
  subpages: SubpageItem[];
}) {
  const { tr } = useAppI18n();
  const [links, setLinks] = useState<OrbitPageCampaignLink[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const selectedSlugRef = useRef(selectedSlug);
  selectedSlugRef.current = selectedSlug;
  const selected = links.find((link) => link.slug === selectedSlug) || links[0];
  const destinations = useMemo(() => [
    { value: '', label: tr('Main page', 'Pagina principale') },
    ...(menu.enabled ? [{ value: 'menu', label: tr('Full menu', 'Menu completo') }] : []),
    ...menu.sections.filter((section) => menu.enabled && section.visible && !section.parentId)
      .map((section) => ({ value: `menu?section=${section.id}`, label: `${tr('Menu section', 'Sezione menu')}: ${section.name}` })),
    ...subpages.filter((page) => page.enabled).map((page) => ({ value: page.slug, label: `${tr('Page', 'Pagina')}: ${page.title}` })),
  ], [menu.enabled, menu.sections, subpages, tr]);

  useEffect(() => {
    let active = true;
    campaignLinksApi.get().then((result) => {
      if (!active) return;
      setLinks(result.data);
      onBaseUrl(result.campaignBaseUrl);
      if (!result.data.some((link) => link.slug === selectedSlugRef.current)) onSelect(result.data[0]?.slug || '');
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : tr('Campaign links could not be loaded.', 'Impossibile caricare i link campagna.'));
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [onBaseUrl, onSelect, tr]);

  const replaceSelected = (patch: Partial<OrbitPageCampaignLink>) => {
    if (!selected) return;
    const next = { ...selected, ...patch };
    setLinks((current) => current.map((link) => link === selected ? next : link));
    if (patch.slug !== undefined) onSelect(patch.slug);
  };

  const replaceRule = (index: number, patch: Partial<OrbitPageCampaignRule>) => {
    if (!selected) return;
    replaceSelected({ rules: selected.rules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule) });
  };

  const addCampaign = () => {
    const used = new Set(links.map((link) => link.slug));
    let suffix = links.length + 1;
    while (used.has(`smart-menu-${suffix}`)) suffix += 1;
    const campaign: OrbitPageCampaignLink = {
      slug: `smart-menu-${suffix}`,
      label: tr('Smart menu', 'Menu smart'),
      destination: menu.enabled ? 'menu' : '',
      timezone: defaultTimezone(),
      enabled: true,
      rules: [],
    };
    setLinks((current) => [...current, campaign]);
    onSelect(campaign.slug);
    setMessage(tr('Configure the link, then save it.', 'Configura il link, poi salvalo.'));
  };

  const applyMealPreset = () => replaceSelected({
    destination: menu.enabled ? 'menu' : '',
    rules: [
      { label: tr('Lunch', 'Pranzo'), destination: menuDestination(menu, /pranzo|lunch/i), startTime: '11:30', endTime: '15:00', enabled: true },
      { label: tr('Dinner', 'Cena'), destination: menuDestination(menu, /cena|dinner/i), startTime: '18:00', endTime: '23:30', enabled: true },
    ],
  });

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await campaignLinksApi.update(links);
      setLinks(result.data);
      setMessage(tr('Campaign link published. Existing QR codes now use these rules.', 'Link campagna pubblicato. I QR esistenti ora usano queste regole.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr('Campaign link could not be saved.', 'Impossibile salvare il link campagna.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm(tr('Delete this campaign link?', 'Eliminare questo link campagna?'))) return;
    const next = links.filter((link) => link !== selected);
    setBusy(true);
    try {
      const result = await campaignLinksApi.update(next);
      setLinks(result.data);
      onSelect(result.data[0]?.slug || '');
      setMessage(tr('Campaign link deleted.', 'Link campagna eliminato.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr('Campaign link could not be deleted.', 'Impossibile eliminare il link campagna.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3" aria-labelledby="campaign-links-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="campaign-links-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Clock3 className="h-4 w-4 text-blue-600" />{tr('Smart QR and campaign links', 'Smart QR e link campagna')}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">{tr('Keep one QR forever and change its destination or schedule here.', 'Mantieni lo stesso QR e cambia qui destinazione o orari.')}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addCampaign} disabled={busy || readOnly || links.length >= 20}><Plus className="h-4 w-4" />{tr('New', 'Nuovo')}</Button>
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2" role="list" aria-label={tr('Campaign links', 'Link campagna')}>
          {links.map((link) => <button key={link.slug} type="button" onClick={() => onSelect(link.slug)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${selected?.slug === link.slug ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{link.label}</button>)}
        </div>
      )}

      {!busy && !selected && <p className="text-xs text-slate-600">{tr('Create a campaign link to generate a dynamic QR.', 'Crea un link campagna per generare un QR dinamico.')}</p>}

      {selected && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="campaign-label" className="text-xs">{tr('Name', 'Nome')}</Label><Input id="campaign-label" value={selected.label} maxLength={80} disabled={readOnly} onChange={(event) => replaceSelected({ label: event.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="campaign-slug" className="text-xs">Slug</Label><Input id="campaign-slug" value={selected.slug} maxLength={48} disabled={readOnly} onChange={(event) => replaceSelected({ slug: cleanSlug(event.target.value) })} /></div>
            <div className="space-y-1.5"><Label htmlFor="campaign-destination" className="text-xs">{tr('Default destination', 'Destinazione predefinita')}</Label><Input id="campaign-destination" list="campaign-destinations" value={selected.destination} maxLength={160} disabled={readOnly} onChange={(event) => replaceSelected({ destination: event.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="campaign-timezone" className="text-xs">{tr('Timezone', 'Fuso orario')}</Label><Input id="campaign-timezone" value={selected.timezone} maxLength={80} disabled={readOnly} onChange={(event) => replaceSelected({ timezone: event.target.value })} /></div>
          </div>
          <datalist id="campaign-destinations">{destinations.map((destination) => <option key={destination.value || 'root'} value={destination.value}>{destination.label}</option>)}</datalist>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-blue-100 pt-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={selected.enabled} disabled={readOnly} onChange={(event) => replaceSelected({ enabled: event.target.checked })} />{tr('Link active', 'Link attivo')}</label>
            <Button type="button" size="sm" variant="outline" onClick={applyMealPreset} disabled={readOnly || !menu.enabled}>{tr('Lunch + dinner preset', 'Preset pranzo + cena')}</Button>
          </div>

          {selected.rules.map((rule, index) => (
            <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 sm:grid-cols-[28px_1fr_1fr_105px_105px]" key={`${rule.label}-${index}`}>
              <label className="grid min-h-10 place-items-center"><input aria-label={tr('Rule active', 'Regola attiva')} type="checkbox" checked={rule.enabled} disabled={readOnly} onChange={(event) => replaceRule(index, { enabled: event.target.checked })} /></label>
              <Input aria-label={tr('Rule name', 'Nome regola')} value={rule.label} maxLength={48} disabled={readOnly} onChange={(event) => replaceRule(index, { label: event.target.value })} />
              <Input aria-label={tr('Rule destination', 'Destinazione regola')} list="campaign-destinations" value={rule.destination} maxLength={160} disabled={readOnly} onChange={(event) => replaceRule(index, { destination: event.target.value })} />
              <Input aria-label={tr('Start time', 'Ora inizio')} type="time" value={rule.startTime} disabled={readOnly} onChange={(event) => replaceRule(index, { startTime: event.target.value })} />
              <Input aria-label={tr('End time', 'Ora fine')} type="time" value={rule.endTime} disabled={readOnly} onChange={(event) => replaceRule(index, { endTime: event.target.value })} />
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => { void save(); }} disabled={busy || readOnly || !selected.slug || !selected.label}><Save className="h-4 w-4" />{tr('Save and publish', 'Salva e pubblica')}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { void remove(); }} disabled={busy || readOnly}><Trash2 className="h-4 w-4" />{tr('Delete', 'Elimina')}</Button>
          </div>
        </div>
      )}
      {message && <p className="text-xs font-medium text-slate-700" role="status">{message}</p>}
    </section>
  );
}
