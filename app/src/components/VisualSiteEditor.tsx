import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  Check,
  Edit,
  Files,
  GripVertical,
  Layout,
  Menu as MenuIcon,
  MousePointerClick,
  RotateCcw,
  ShoppingBag,
  UserRound,
} from "@/components/ui/material-icons";
import { LivePreview, PreviewDeviceToggle, type PreviewDevice } from "./LivePreview";
import type { LinkData } from "./LinkCard";
import type { PublicEditorTarget } from "./PublicView";
import type { ThemeConfig } from "@/lib/theme";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import { DEFAULT_PROFILE_LAYOUT, type ProfileLayout, type ProfileLayoutViewport } from "@/lib/profile-layout";
import type { CardLayout } from "@/lib/card-layout";
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

export type VisualSiteEditorSection = "profile" | "links" | "menu" | "shop" | "pages";

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
  onOpenTheme?: () => void;
  onProfileLayoutChange?: (layout: ProfileLayout, viewport: ProfileLayoutViewport) => void;
  onCardLayoutChange?: (layout: CardLayout | null, viewport: ProfileLayoutViewport) => void;
  previewHint?: string;
  renderPreview?: (device: PreviewDevice) => ReactNode;
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
  onOpenTheme,
  onProfileLayoutChange,
  onCardLayoutChange,
  previewHint,
  renderPreview,
}: VisualSiteEditorProps) {
  const { tr } = useAppI18n();
  const [device, setDevice] = useState<PreviewDevice>(() => (
    typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches ? "desktop" : "mobile"
  ));
  const [layoutEditing, setLayoutEditing] = useState(false);
  const sections: VisualSectionItem[] = [
    { id: "profile", label: tr("Page", "Pagina"), icon: UserRound, status: "active" },
    { id: "links", label: tr("Content", "Contenuti"), icon: Layout, status: "active" },
    { id: "menu", label: tr("Menu", "Menu"), icon: MenuIcon, status: menuStatus },
    { id: "shop", label: tr("Shop", "Shop"), icon: ShoppingBag, status: shopStatus },
    { id: "pages", label: tr("Pages", "Pagine"), icon: Files, status: pagesStatus },
  ];
  const editorSelection: PublicEditorTarget | null = section === "profile"
    ? { kind: "profile" }
    : section === "links" && selectedLinkId
      ? { kind: "link", id: selectedLinkId }
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
    onOpenTheme?.();
  };

  useEffect(() => {
    if (section !== "profile") setLayoutEditing(false);
  }, [section]);

  const toggleLayoutEditing = () => {
    if (layoutEditing) {
      setLayoutEditing(false);
      return;
    }
    if (section !== "profile") onSelect("profile");
    setLayoutEditing(true);
  };

  return (
    <section className={`visual-site-editor${layoutEditing ? " visual-site-editor--layout-editing" : ""}`} aria-label={tr("Visual site editor", "Editor visuale del sito")}>
      <header className="visual-site-editor__toolbar">
        <div className="visual-site-editor__intro">
          <span className="visual-site-editor__mark"><MousePointerClick aria-hidden="true" size={18} /></span>
          <div>
            <strong>{tr("Edit the real page", "Modifica la pagina reale")}</strong>
            <small>{tr("Select an element in the preview to open its settings.", "Seleziona un elemento nell’anteprima per aprire le sue impostazioni.")}</small>
          </div>
        </div>
        <div className="visual-site-editor__toolbar-actions">
          {layoutEditing && onProfileLayoutChange && onCardLayoutChange && (
            <button
              aria-label={tr("Reset to standard layout", "Ripristina il layout standard")}
              className="visual-site-editor__layout-reset"
              onClick={() => {
                onProfileLayoutChange(DEFAULT_PROFILE_LAYOUT, device);
                onCardLayoutChange(null, device);
              }}
              title={tr("Reset to standard layout", "Ripristina il layout standard")}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} />
              <span>{tr("Reset", "Ripristina")}</span>
            </button>
          )}
          {(section === "profile" || section === "links") && onProfileLayoutChange && onCardLayoutChange && (
            <button
              aria-pressed={layoutEditing}
              className={`visual-site-editor__layout-toggle${layoutEditing ? " is-active" : ""}`}
              onClick={toggleLayoutEditing}
              title={layoutEditing ? tr("Finish arranging", "Termina disposizione") : tr("Arrange page layout", "Disponi il layout della pagina")}
              type="button"
            >
              {layoutEditing ? <Check aria-hidden="true" size={17} /> : <Edit aria-hidden="true" size={17} />}
              <span>{layoutEditing ? tr("Done", "Fatto") : tr("Arrange", "Disponi")}</span>
            </button>
          )}
          <PreviewDeviceToggle value={device} onChange={setDevice} />
        </div>
      </header>

      <nav className="visual-site-editor__sections" aria-label={tr("Site sections", "Sezioni del sito")}>
        {sections.map(({ id, icon: Icon, label, status }) => (
          <button
            aria-current={section === id ? "page" : undefined}
            className={section === id ? "is-active" : ""}
            data-status={status}
            disabled={layoutEditing && id !== "profile"}
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

      {layoutEditing && (
        <div className="visual-site-editor__layout-bar">
          <span role="status">
            <GripVertical aria-hidden="true" size={17} />
            <strong>{device === "mobile" ? tr("Mobile layout", "Layout mobile") : tr("Desktop layout", "Layout desktop")}</strong>
            <span>{tr("Drag profile elements, cards and card contents. On mobile, only small cards can sit side by side.", "Trascina elementi del profilo, card e contenuti interni. Su mobile solo le card piccole possono essere affiancate.")}</span>
          </span>
        </div>
      )}

      <div className="visual-site-editor__workspace">
        <div className="visual-site-editor__canvas" data-device={device}>
          <div className="visual-site-editor__canvas-note">
            <MousePointerClick aria-hidden="true" size={15} />
            <span>{previewHint || tr("Click profile, cards or background to edit", "Clicca profilo, card o sfondo per modificare")}</span>
          </div>
          {renderPreview ? renderPreview(device) : (
            <LivePreview
              device={device}
              editorSelection={editorSelection}
              links={links}
              onEditorSelect={selectFromPreview}
              onProfileLayoutChange={onProfileLayoutChange ? (layout) => onProfileLayoutChange(layout, device) : undefined}
              onCardLayoutChange={onCardLayoutChange ? (layout) => onCardLayoutChange(layout, device) : undefined}
              profile={profile}
              profileLayoutEditing={layoutEditing}
              cardLayoutEditing={layoutEditing}
              publicPageHref={publicPageHref}
              showOrbitPageBadge={showOrbitPageBadge}
              theme={theme}
            />
          )}
        </div>

        <aside className="visual-site-editor__inspector" aria-label={inspectorTitle}>
          <header className="visual-site-editor__inspector-heading">
            {section !== "menu" && <p>{tr("Selected element", "Elemento selezionato")}</p>}
            <h2>{inspectorTitle}</h2>
            <span>{inspectorDescription}</span>
          </header>
          <div className="visual-site-editor__inspector-body">{inspector}</div>
        </aside>
      </div>
    </section>
  );
}
