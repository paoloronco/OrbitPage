import { useState, type ComponentType, type ReactNode } from "react";
import {
  Files,
  Layout,
  Menu as MenuIcon,
  MousePointerClick,
  Palette,
  ShoppingBag,
  UserRound,
} from "@/components/ui/material-icons";
import { LivePreview, PreviewDeviceToggle, type PreviewDevice } from "./LivePreview";
import type { LinkData } from "./LinkCard";
import type { PublicEditorTarget } from "./PublicView";
import type { ThemeConfig } from "@/lib/theme";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import { useAppI18n } from "@/lib/i18n";
import "./visual-site-editor.css";

type VisualProfile = {
  name: string;
  bio: string;
  avatar: string;
  showAvatar?: boolean;
  socialLinks?: Record<string, string | undefined>;
  nameFontSize?: string;
  bioFontSize?: string;
  appearance?: ProfileAppearance;
  footerText?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
};

export type VisualSiteEditorSection = "profile" | "links" | "menu" | "shop" | "pages" | "theme";

type VisualSectionItem = {
  id: VisualSiteEditorSection;
  label: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  status?: "active" | "inactive" | "locked";
};

interface VisualSiteEditorProps {
  profile: VisualProfile;
  links: LinkData[];
  theme: ThemeConfig;
  publicPageHref: string;
  showOrbitPageBadge: boolean;
  section: VisualSiteEditorSection;
  selectedLinkId?: string | null;
  inspectorTitle: string;
  inspectorDescription: string;
  inspector: ReactNode;
  menuStatus?: VisualSectionItem["status"];
  shopStatus?: VisualSectionItem["status"];
  pagesStatus?: VisualSectionItem["status"];
  onSelect: (section: VisualSiteEditorSection, linkId?: string) => void;
}

export function VisualSiteEditor({
  profile,
  links,
  theme,
  publicPageHref,
  showOrbitPageBadge,
  section,
  selectedLinkId,
  inspectorTitle,
  inspectorDescription,
  inspector,
  menuStatus = "inactive",
  shopStatus = "inactive",
  pagesStatus = "inactive",
  onSelect,
}: VisualSiteEditorProps) {
  const { tr } = useAppI18n();
  const [device, setDevice] = useState<PreviewDevice>("mobile");
  const sections: VisualSectionItem[] = [
    { id: "profile", label: tr("Page", "Pagina"), icon: UserRound, status: "active" },
    { id: "links", label: tr("Content", "Contenuti"), icon: Layout, status: "active" },
    { id: "menu", label: tr("Menu", "Menu"), icon: MenuIcon, status: menuStatus },
    { id: "shop", label: tr("Shop", "Shop"), icon: ShoppingBag, status: shopStatus },
    { id: "pages", label: tr("Pages", "Pagine"), icon: Files, status: pagesStatus },
    { id: "theme", label: tr("Style", "Stile"), icon: Palette, status: "active" },
  ];
  const editorSelection: PublicEditorTarget | null = section === "profile"
    ? { kind: "profile" }
    : section === "links" && selectedLinkId
      ? { kind: "link", id: selectedLinkId }
      : section === "theme"
        ? { kind: "page" }
        : null;

  const selectFromPreview = (target: PublicEditorTarget) => {
    if (target.kind === "profile") {
      onSelect("profile");
      return;
    }
    if (target.kind === "link") {
      onSelect("links", target.id);
      return;
    }
    onSelect("theme");
  };

  return (
    <section className="visual-site-editor" aria-label={tr("Visual site editor", "Editor visuale del sito")}>
      <header className="visual-site-editor__toolbar">
        <div className="visual-site-editor__intro">
          <span className="visual-site-editor__mark"><MousePointerClick aria-hidden="true" size={18} /></span>
          <div>
            <strong>{tr("Edit the real page", "Modifica la pagina reale")}</strong>
            <small>{tr("Select an element in the preview to open its settings.", "Seleziona un elemento nell’anteprima per aprire le sue impostazioni.")}</small>
          </div>
        </div>
        <PreviewDeviceToggle value={device} onChange={setDevice} />
      </header>

      <nav className="visual-site-editor__sections" aria-label={tr("Site sections", "Sezioni del sito")}>
        {sections.map(({ id, icon: Icon, label, status }) => (
          <button
            aria-current={section === id ? "page" : undefined}
            className={section === id ? "is-active" : ""}
            data-status={status}
            key={id}
            onClick={() => onSelect(id)}
            type="button"
          >
            <Icon aria-hidden="true" size={16} />
            <span>{label}</span>
            {(status === "inactive" || status === "locked") && <i aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <div className="visual-site-editor__workspace">
        <div className="visual-site-editor__canvas" data-device={device}>
          <div className="visual-site-editor__canvas-note">
            <MousePointerClick aria-hidden="true" size={15} />
            <span>{tr("Click profile, cards or background to edit", "Clicca profilo, card o sfondo per modificare")}</span>
          </div>
          <LivePreview
            device={device}
            editorSelection={editorSelection}
            links={links}
            onEditorSelect={selectFromPreview}
            profile={profile}
            publicPageHref={publicPageHref}
            showOrbitPageBadge={showOrbitPageBadge}
            theme={theme}
          />
        </div>

        <aside className="visual-site-editor__inspector" aria-label={inspectorTitle}>
          <header className="visual-site-editor__inspector-heading">
            <p>{tr("Selected element", "Elemento selezionato")}</p>
            <h2>{inspectorTitle}</h2>
            <span>{inspectorDescription}</span>
          </header>
          <div className="visual-site-editor__inspector-body">{inspector}</div>
        </aside>
      </div>
    </section>
  );
}
