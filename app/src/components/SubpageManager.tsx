import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeOrbitPageSubpageSlug } from "@orbitpage/page-schema";
import { Copy, ExternalLink, FilePlus2, Files, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type { SubpageItem } from "@/lib/api-client";
import type { LinkEditMode } from "@/lib/permissions";
import type { ThemeConfig } from "@/lib/theme";
import type { InternalDestinationOption } from "@/lib/link-blocks";
import type { LinkData } from "./LinkCard";
import { LinkManager } from "./LinkManager";

export type EditorSubpage = Omit<SubpageItem, "links"> & { links: LinkData[] };

type Props = {
  pages: EditorSubpage[];
  theme: ThemeConfig;
  publicPageHref: string;
  onPagesUpdate: (pages: EditorSubpage[]) => Promise<void>;
  renderPreview?: (page: EditorSubpage, links: LinkData[]) => ReactNode;
  onPreviewChange?: (preview: { page: EditorSubpage; links: LinkData[] } | null) => void;
  editMode: LinkEditMode;
  maxPages?: number | null;
  maxBlocks?: number | null;
  planName?: string;
  schedulingEnabled?: boolean;
  videoUploadsEnabled?: boolean;
  maxVideoUploadBytes?: number | null;
  managePlanHref?: string;
  internalDestinations?: InternalDestinationOption[];
};

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

function newPage(): EditorSubpage {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), slug: "new-page", title: "Untitled page", description: "", links: [],
    enabled: false, createdAt: now, updatedAt: now,
  };
}

export function SubpageManager({
  pages, theme, publicPageHref, onPagesUpdate, renderPreview, onPreviewChange, editMode, maxPages, maxBlocks, planName,
  schedulingEnabled, videoUploadsEnabled, maxVideoUploadBytes, managePlanHref,
  internalDestinations = [],
}: Props) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(pages[0]?.id || "");
  const [draft, setDraft] = useState<EditorSubpage | null>(pages[0] || null);
  const [previewLinks, setPreviewLinks] = useState<LinkData[]>(pages[0]?.links || []);
  const [blocksDirty, setBlocksDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingSelectionId = useRef<string | null>(null);
  const selected = useMemo(() => pages.find((page) => page.id === selectedId) || null, [pages, selectedId]);
  const detailsDirty = Boolean(draft && selected && (
    draft.title !== selected.title
    || draft.slug !== selected.slug
    || draft.description !== selected.description
    || draft.enabled !== selected.enabled
  ));
  const pageLimitReached = maxPages !== undefined && maxPages !== null && pages.length + 1 >= maxPages;
  const hasUnsavedChanges = detailsDirty || blocksDirty;
  const previewPage = draft?.id === selected?.id ? draft : null;

  useEffect(() => {
    if (pendingSelectionId.current) {
      if (pages.some((page) => page.id === pendingSelectionId.current)) {
        setSelectedId(pendingSelectionId.current);
        pendingSelectionId.current = null;
      }
      return;
    }
    if (busy) return;
    setSelectedId((current) => pages.some((page) => page.id === current) ? current : pages[0]?.id || "");
  }, [busy, pages]);

  useEffect(() => {
    setDraft(selected);
    setPreviewLinks(selected?.links || []);
    setBlocksDirty(false);
  }, [selected]);

  useEffect(() => {
    onPreviewChange?.(previewPage ? { page: previewPage, links: previewLinks } : null);
  }, [onPreviewChange, previewPage, previewLinks]);

  useEffect(() => () => onPreviewChange?.(null), [onPreviewChange]);

  const canLeavePage = () => !hasUnsavedChanges || window.confirm("Discard unsaved changes on this page?");
  const selectPage = (id: string) => {
    if (id === selected?.id || busy || !canLeavePage()) return;
    setSelectedId(id);
  };

  const persist = async (nextPages: EditorSubpage[], message?: string) => {
    setBusy(true);
    try {
      await onPagesUpdate(nextPages);
      if (message) toast({ title: message });
    } finally {
      setBusy(false);
    }
  };

  const addPage = async () => {
    if (busy || !canLeavePage()) return;
    if (pageLimitReached) {
      toast({
        title: `${planName || "Current plan"}: page limit reached`,
        description: `Your main page already counts as one of the ${maxPages} available pages.`,
        variant: "destructive",
      });
      return;
    }
    const page = newPage();
    let suffix = 2;
    while (pages.some((item) => item.slug === page.slug)) page.slug = `new-page-${suffix++}`;
    pendingSelectionId.current = page.id;
    setSelectedId(page.id);
    try {
      await persist([...pages, page], "Draft page created");
    } catch {
      pendingSelectionId.current = null;
      setSelectedId(selected?.id || "");
    }
  };

  const validatedDraft = () => {
    if (!draft) return null;
    const slug = normalizeOrbitPageSubpageSlug(draft.slug);
    if (!slug) {
      toast({ title: "Choose a valid slug", description: "Use letters, numbers and hyphens. Reserved paths cannot be used.", variant: "destructive" });
      return null;
    }
    if (!draft.title.trim()) {
      toast({ title: "Add a page title", variant: "destructive" });
      return null;
    }
    if (pages.some((page) => page.id !== draft.id && page.slug === slug)) {
      toast({ title: "This URL is already in use", description: "Choose a different slug.", variant: "destructive" });
      return null;
    }
    return { ...draft, slug, title: draft.title.trim(), description: draft.description.trim(), updatedAt: new Date().toISOString() };
  };

  const saveDetails = async () => {
    if (blocksDirty) return;
    const next = validatedDraft();
    if (!next) return;
    await persist(pages.map((page) => page.id === next.id ? next : page), "Page details saved");
    setDraft(next);
  };

  const updateLinks = async (links: LinkData[]) => {
    const details = validatedDraft();
    if (!details) throw new Error("Fix the page settings before saving content.");
    const next = { ...details, links };
    await persist(pages.map((page) => page.id === next.id ? next : page));
    setDraft(next);
  };

  const removePage = async () => {
    if (!draft || !window.confirm(`Delete “${draft.title}”? Its public URL will stop working.`)) return;
    await persist(pages.filter((page) => page.id !== draft.id), "Page deleted");
  };

  const pageUrl = selected ? `${publicPageHref.replace(/\/$/, "")}/${selected.slug}` : publicPageHref;
  const copyPageUrl = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast({ title: "Page URL copied" });
    } catch {
      toast({ title: "Could not copy the URL", variant: "destructive" });
    }
  };

  return (
    <div className="subpage-manager">
      <header className="subpage-overview">
        <div>
          <span className="admin-kicker">Site editor / Pages</span>
          <h2>Additional pages</h2>
          <p>Give a topic, service or campaign its own URL. Choose a page below, set its details, then add content.</p>
        </div>
        <div className="subpage-overview-actions">
          <span className="subpage-count">{pages.length + 1}{maxPages ? ` / ${maxPages}` : ""} pages used</span>
          <Button type="button" onClick={addPage} disabled={busy || pageLimitReached || editMode === "view"}>
            <FilePlus2 className="h-4 w-4" /> Add page
          </Button>
        </div>
      </header>

      <section className="subpage-collection" aria-label="Your pages">
        <div className="subpage-collection-heading">
          <h3>Your pages</h3>
          <p>Your main page is always available. Additional pages start hidden until you publish them.</p>
        </div>
        <div className="subpage-page-grid">
          <div className="subpage-page-card subpage-page-card--main">
            <Files className="h-5 w-5" aria-hidden="true" />
            <span className="subpage-page-card-copy"><strong>Main page</strong><small>{publicPageHref.replace(/^https?:\/\//, "")}</small></span>
            <span className="subpage-page-status">Home</span>
          </div>
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              aria-current={page.id === selected?.id ? "page" : undefined}
              className={`subpage-page-card ${page.id === selected?.id ? "is-active" : ""}`}
              onClick={() => selectPage(page.id)}
              disabled={busy}
            >
              <Files className="h-5 w-5" aria-hidden="true" />
              <span className="subpage-page-card-copy"><strong>{page.title}</strong><small>/{page.slug}</small></span>
              <span className={`subpage-page-status ${page.enabled ? "is-live" : ""}`}>{page.enabled ? "Live" : "Hidden"}</span>
            </button>
          ))}
        </div>
        {pageLimitReached && (
          <Card className="subpage-upgrade-note">
            <span>Page limit reached. Your main page counts toward the limit.</span>
            <a href={managePlanHref || "/dashboard/billing"} target="_top">Compare plans</a>
          </Card>
        )}
      </section>

      {draft && (
        <div className="subpage-workspace">
          <section className="subpage-details-panel" aria-labelledby="subpage-details-title">
            <div className="subpage-section-heading">
              <div><span className="admin-kicker">01 / Setup</span><h3 id="subpage-details-title">Page settings</h3><p>Give this page a clear name and URL, then choose when it becomes public.</p></div>
              <span className={`subpage-page-status ${selected?.enabled ? "is-live" : ""}`}>{selected?.enabled ? "Live" : "Hidden"}</span>
            </div>
            <div className="subpage-public-url">
              <div><span>Public URL</span><code>{pageUrl}</code>{draft.slug !== selected?.slug && <small>Save the new slug to update this URL.</small>}</div>
              <div className="subpage-url-actions">
                <Button aria-label="Copy public URL" type="button" variant="outline" size="sm" onClick={copyPageUrl}><Copy className="h-4 w-4" /> Copy</Button>
                {selected?.enabled
                  ? <Button asChild variant="outline" size="sm"><a href={pageUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Open</a></Button>
                  : <Button type="button" variant="outline" size="sm" disabled title="Publish this page before opening its public URL"><ExternalLink className="h-4 w-4" /> Open</Button>}
              </div>
            </div>
            <div className="subpage-details-grid">
              <div className="subpage-field"><Label htmlFor="subpage-title">Page title</Label><Input id="subpage-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value.slice(0, 80) })} disabled={editMode === "view"} /><small>Shown on the page and in your page list.</small></div>
              <div className="subpage-field"><Label htmlFor="subpage-slug">URL slug</Label><div className="subpage-slug-field"><span>/</span><Input id="subpage-slug" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} disabled={editMode === "view"} /></div><small>Short, unique and easy to share.</small></div>
              <div className="subpage-field subpage-description-field"><Label htmlFor="subpage-description">Description <span>(optional)</span></Label><Textarea id="subpage-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value.slice(0, 240) })} disabled={editMode === "view"} /><small>{draft.description.length} / 240 characters</small></div>
            </div>
            <div className="subpage-details-footer">
              <div className="subpage-visibility">
                <button type="button" className={`subpage-publish-toggle ${draft.enabled ? "is-active" : ""}`} onClick={() => setDraft({ ...draft, enabled: !draft.enabled })} aria-pressed={draft.enabled} disabled={busy || editMode === "view"}>
                  <span aria-hidden="true" /> {draft.enabled ? "Published" : "Hidden"}
                </button>
                <small>{draft.enabled ? "Anyone with the link can view this page after you save." : "Only you can edit this page until you publish it."}</small>
              </div>
              <div className="subpage-detail-actions">
                <Button type="button" variant="outline" onClick={removePage} disabled={busy || editMode === "view"}><Trash2 className="h-4 w-4" /> Delete</Button>
                <Button type="button" onClick={saveDetails} disabled={!detailsDirty || blocksDirty || busy || editMode === "view"}><Save className="h-4 w-4" /> Save settings</Button>
              </div>
            </div>
            {blocksDirty && <p className="subpage-save-hint" role="status">Save your content cards first. That will also save any pending page settings.</p>}
          </section>

          <section className="subpage-content-panel" aria-labelledby="subpage-content-title">
            <div className="subpage-section-heading"><div><span className="admin-kicker">02 / Content</span><h3 id="subpage-content-title">Build this page</h3><p>Add and arrange content cards below. Save them using the button in the content toolbar.</p></div></div>
            <LinkManager
              key={draft.id}
              links={draft.links}
              theme={theme}
              onLinksUpdate={updateLinks}
              onLinksPreview={setPreviewLinks}
              onDirtyChange={setBlocksDirty}
              editMode={editMode}
              maxBlocks={maxBlocks}
              planName={planName}
              schedulingEnabled={schedulingEnabled}
              videoUploadsEnabled={videoUploadsEnabled}
              maxVideoUploadBytes={maxVideoUploadBytes}
              managePlanHref={managePlanHref}
              nativeMenuEnabled={false}
              publicPageHref={pageUrl}
              availablePages={internalDestinations
                .filter((destination) => destination.kind === "page" && destination.path !== `/${selected?.slug}`)
                .map((destination) => ({ title: destination.title, url: `${publicPageHref.replace(/\/$/, "")}${destination.path}` }))}
              internalDestinations={internalDestinations.filter((destination) => destination.path !== `/${selected?.slug}`)}
            />
          </section>
        </div>
      )}
      {draft && renderPreview && <details className="subpage-preview-panel"><summary>Preview this page</summary>{renderPreview(draft, previewLinks)}</details>}
    </div>
  );
}
