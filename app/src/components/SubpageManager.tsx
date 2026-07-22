import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import type { LinkData } from "./LinkCard";
import { LinkManager } from "./LinkManager";

export type EditorSubpage = Omit<SubpageItem, "links"> & { links: LinkData[] };

type Props = {
  pages: EditorSubpage[];
  theme: ThemeConfig;
  publicPageHref: string;
  onPagesUpdate: (pages: EditorSubpage[]) => Promise<void>;
  renderPreview: (page: EditorSubpage, links: LinkData[]) => ReactNode;
  editMode: LinkEditMode;
  maxPages?: number | null;
  maxBlocks?: number | null;
  planName?: string;
  schedulingEnabled?: boolean;
  videoUploadsEnabled?: boolean;
  maxVideoUploadBytes?: number | null;
  managePlanHref?: string;
};

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

function newPage(): EditorSubpage {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), slug: "new-page", title: "New page", description: "", links: [],
    enabled: true, createdAt: now, updatedAt: now,
  };
}

export function SubpageManager({
  pages, theme, publicPageHref, onPagesUpdate, renderPreview, editMode, maxPages, maxBlocks, planName,
  schedulingEnabled, videoUploadsEnabled, maxVideoUploadBytes, managePlanHref,
}: Props) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(pages[0]?.id || "");
  const [draft, setDraft] = useState<EditorSubpage | null>(pages[0] || null);
  const [previewLinks, setPreviewLinks] = useState<LinkData[]>(pages[0]?.links || []);
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => pages.find((page) => page.id === selectedId) || pages[0] || null, [pages, selectedId]);
  const detailsDirty = Boolean(draft && selected && (
    draft.title !== selected.title
    || draft.slug !== selected.slug
    || draft.description !== selected.description
    || draft.enabled !== selected.enabled
  ));
  const pageLimitReached = maxPages !== undefined && maxPages !== null && pages.length + 1 >= maxPages;

  useEffect(() => {
    setSelectedId((current) => pages.some((page) => page.id === current) ? current : pages[0]?.id || "");
  }, [pages]);

  useEffect(() => {
    setDraft(selected);
    setPreviewLinks(selected?.links || []);
  }, [selected]);

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
    await persist([...pages, page], "Page created");
    setSelectedId(page.id);
  };

  const saveDetails = async () => {
    if (!draft) return;
    const slug = slugify(draft.slug);
    if (!slug) {
      toast({ title: "Choose a valid slug", description: "Use letters, numbers and hyphens.", variant: "destructive" });
      return;
    }
    if (!draft.title.trim()) {
      toast({ title: "Add a page title", variant: "destructive" });
      return;
    }
    const next = { ...draft, slug, title: draft.title.trim(), description: draft.description.trim(), updatedAt: new Date().toISOString() };
    await persist(pages.map((page) => page.id === next.id ? next : page), "Page details saved");
    setDraft(next);
  };

  const updateLinks = async (links: LinkData[]) => {
    if (!draft) return;
    const next = { ...draft, links, updatedAt: new Date().toISOString() };
    await persist(pages.map((page) => page.id === next.id ? next : page));
    setDraft(next);
  };

  const removePage = async () => {
    if (!draft || !window.confirm(`Delete “${draft.title}”? Its public URL will stop working.`)) return;
    await persist(pages.filter((page) => page.id !== draft.id), "Page deleted");
  };

  const pageUrl = draft ? `${publicPageHref.replace(/\/$/, "")}/${draft.slug}` : publicPageHref;

  return (
    <div className="subpage-manager">
      <aside className="subpage-list-panel">
        <div className="subpage-list-header">
          <div><span>Pages</span><strong>{pages.length + 1}{maxPages ? ` / ${maxPages}` : ""}</strong></div>
          <Button type="button" size="icon" onClick={addPage} disabled={busy || pageLimitReached || editMode === "view"} title="Create page">
            <FilePlus2 className="h-4 w-4" />
          </Button>
        </div>
        <button type="button" className="subpage-list-item subpage-list-item--main" disabled>
          <Files className="h-4 w-4" /><span><strong>Main page</strong><small>{publicPageHref.replace(/^https?:\/\//, "")}</small></span>
        </button>
        {pages.map((page) => (
          <button key={page.id} type="button" className={`subpage-list-item ${page.id === selected?.id ? "is-active" : ""}`} onClick={() => setSelectedId(page.id)}>
            <span className={`subpage-status ${page.enabled ? "is-live" : ""}`} />
            <span><strong>{page.title}</strong><small>/{page.slug}</small></span>
          </button>
        ))}
        {pageLimitReached && maxPages === 1 && (
          <Card className="subpage-upgrade-note">
            <strong>More pages are a paid-plan feature.</strong>
            <p>Starter includes 3 pages; Pro includes 10.</p>
            <a href={managePlanHref || "/dashboard/billing"} target="_top">Compare plans</a>
          </Card>
        )}
      </aside>

      <div className="subpage-editor-column">
        {!draft ? (
          <Card className="admin-empty-state">
            <Files className="mx-auto h-8 w-8 text-blue-600" />
            <h3>Create a focused destination</h3>
            <p>Use a subpage for events, services, campaigns or any group of blocks that deserves its own URL.</p>
            <Button onClick={addPage} disabled={pageLimitReached || editMode === "view"}><FilePlus2 className="h-4 w-4" /> Create page</Button>
          </Card>
        ) : (
          <>
            <section className="admin-panel subpage-details-panel">
              <div className="subpage-details-heading">
                <div><span className="admin-kicker">Page details</span><h2>{draft.title}</h2></div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(pageUrl)} title="Copy public URL"><Copy className="h-4 w-4" /></Button>
                  <Button asChild variant="outline" size="icon"><a href={pageUrl} target="_blank" rel="noreferrer" title="Open public page"><ExternalLink className="h-4 w-4" /></a></Button>
                  <Button type="button" variant="destructive" size="icon" onClick={removePage} disabled={busy || editMode === "view"} title="Delete page"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="subpage-details-grid">
                <div><Label htmlFor="subpage-title">Title</Label><Input id="subpage-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} disabled={editMode === "view"} /></div>
                <div><Label htmlFor="subpage-slug">Slug</Label><div className="subpage-slug-field"><span>/</span><Input id="subpage-slug" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} disabled={editMode === "view"} /></div></div>
                <div className="subpage-description-field"><Label htmlFor="subpage-description">Description</Label><Textarea id="subpage-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value.slice(0, 240) })} disabled={editMode === "view"} /></div>
              </div>
              <div className="subpage-details-footer">
                <button type="button" className={`subpage-publish-toggle ${draft.enabled ? "is-active" : ""}`} onClick={() => editMode !== "view" && setDraft({ ...draft, enabled: !draft.enabled })} aria-pressed={draft.enabled}>
                  <span /> {draft.enabled ? "Published" : "Hidden"}
                </button>
                <Button onClick={saveDetails} disabled={!detailsDirty || busy || editMode === "view"}><Save className="h-4 w-4" /> Save details</Button>
              </div>
            </section>
            <LinkManager
              key={draft.id}
              links={draft.links}
              theme={theme}
              onLinksUpdate={updateLinks}
              onLinksPreview={setPreviewLinks}
              editMode={editMode}
              maxBlocks={maxBlocks}
              planName={planName}
              schedulingEnabled={schedulingEnabled}
              videoUploadsEnabled={videoUploadsEnabled}
              maxVideoUploadBytes={maxVideoUploadBytes}
              managePlanHref={managePlanHref}
              nativeMenuEnabled={false}
              publicPageHref={pageUrl}
            />
          </>
        )}
      </div>
      {draft && <aside className="admin-workbench-rail subpage-preview-rail">{renderPreview(draft, previewLinks)}</aside>}
    </div>
  );
}
