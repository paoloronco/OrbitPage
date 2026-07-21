import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { FileText, Map, QrCode, Share2 } from "lucide-react";
import { useAppI18n } from "@/lib/i18n";
import { ProfileQrCode } from "./ProfileQrCode";
import { SitemapManager } from "./SitemapManager";
import { TextFileManager } from "./TextFileManager";

type PublishTool = "qr" | "sitemap" | "txt";

interface PublishToolsProps {
  menuEnabled?: boolean;
  readOnly?: boolean;
  canUseQr?: boolean;
  canUseDiscovery?: boolean;
}

const TOOL_STORAGE_KEY = "orbitpage.admin.publish-tool";

export function PublishTools({
  menuEnabled = false,
  readOnly = false,
  canUseQr = true,
  canUseDiscovery = true,
}: PublishToolsProps) {
  const { tr } = useAppI18n();
  const tools = useMemo(() => [
    ...(canUseQr ? [{ id: "qr" as const, icon: QrCode, title: "QR", description: tr("Share the page in print and in person.", "Condividi la pagina su stampa e di persona.") }] : []),
    ...(canUseDiscovery ? [
      { id: "sitemap" as const, icon: Map, title: "Sitemap", description: tr("Keep public routes discoverable.", "Rendi individuabili i percorsi pubblici.") },
      { id: "txt" as const, icon: FileText, title: "TXT", description: tr("Control crawler, AI and trust files.", "Gestisci file per crawler, AI e attendibilità.") },
    ] : []),
  ], [canUseDiscovery, canUseQr, tr]);
  const [activeTool, setActiveTool] = useState<PublishTool>(() => {
    if (typeof window === "undefined") return canUseQr ? "qr" : "sitemap";
    const stored = window.localStorage.getItem(TOOL_STORAGE_KEY);
    return stored === "qr" || stored === "sitemap" || stored === "txt" ? stored : canUseQr ? "qr" : "sitemap";
  });

  useEffect(() => {
    if (tools.some((tool) => tool.id === activeTool)) return;
    setActiveTool(tools[0]?.id || "qr");
  }, [activeTool, tools]);

  const selectTool = (tool: PublishTool) => {
    setActiveTool(tool);
    try {
      window.localStorage.setItem(TOOL_STORAGE_KEY, tool);
    } catch {
      // Remembering the selected tool is optional.
    }
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tools.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tools.length) % tools.length;
    const nextTool = tools[nextIndex];
    if (!nextTool) return;
    selectTool(nextTool.id);
    document.getElementById(`publish-tab-${nextTool.id}`)?.focus();
  };

  return (
    <section className="publish-tools" data-onboarding="publish-section">
      <header className="publish-tools-header">
        <span className="publish-tools-header-icon"><Share2 className="h-5 w-5" /></span>
        <div>
          <p>{tr("Publish tools", "Strumenti di pubblicazione")}</p>
          <h2>{tr("Share your page and make it discoverable.", "Condividi la pagina e rendila facile da trovare.")}</h2>
          <span>{tr("QR, search discovery and public text files live together in one place.", "QR, indicizzazione e file testuali pubblici riuniti in un unico spazio.")}</span>
        </div>
      </header>

      <div className="publish-tools-tabs" role="tablist" aria-label={tr("Publishing tools", "Strumenti di pubblicazione")}>
        {tools.map(({ id, icon: Icon, title, description }, index) => (
          <button
            aria-controls={`publish-tool-${id}`}
            aria-selected={activeTool === id}
            className={activeTool === id ? "publish-tools-tab active" : "publish-tools-tab"}
            id={`publish-tab-${id}`}
            key={id}
            onClick={() => selectTool(id)}
            onKeyDown={(event) => moveFocus(event, index)}
            role="tab"
            tabIndex={activeTool === id ? 0 : -1}
            type="button"
          >
            <span><Icon className="h-4 w-4" /></span>
            <strong>{title}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>

      <div aria-labelledby={`publish-tab-${activeTool}`} className="publish-tools-panel" id={`publish-tool-${activeTool}`} role="tabpanel">
        {activeTool === "qr" && canUseQr && <ProfileQrCode menuEnabled={menuEnabled} />}
        {activeTool === "sitemap" && canUseDiscovery && <SitemapManager readOnly={readOnly} />}
        {activeTool === "txt" && canUseDiscovery && <TextFileManager readOnly={readOnly} />}
      </div>
    </section>
  );
}
