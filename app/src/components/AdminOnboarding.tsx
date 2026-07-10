import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Link,
  Minimize2,
  MousePointerClick,
  Palette,
  Play,
  User,
  X,
} from "lucide-react";

type AdminOnboardingTab = "profile" | "links" | "theme" | "access" | "analytics" | "privacy" | "txt";
type OnboardingMode = "hidden" | "welcome" | "tour" | "minimized";

interface AdminOnboardingProps {
  activeTab: AdminOnboardingTab;
  visibleTabs: AdminOnboardingTab[];
  onSelectTab: (tab: AdminOnboardingTab) => void;
  forceOpen?: boolean;
}

interface TourStep {
  id: string;
  tab?: AdminOnboardingTab;
  target?: string;
  icon: ElementType;
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  visual: "profile" | "save" | "links" | "cards" | "theme" | "public";
}

const STORAGE_KEY = "orbitpage-admin-onboarding-completed";
const FORCE_STORAGE_KEY = "orbitpage-admin-onboarding-force";

const forcedByEnv = import.meta.env.VITE_FORCE_ADMIN_ONBOARDING === "true" || import.meta.env.VITE_FORCE_ADMIN_ONBOARDING === "1";

const tourSteps: TourStep[] = [
  {
    id: "profile-home",
    tab: "profile",
    target: "[data-onboarding='profile-card']",
    icon: User,
    eyebrow: "1. Page",
    title: "Profile first",
    body: "Start from the Page tab. Open the profile card, set the public name, add a short description, and connect the social links that matter.",
    action: "Click the profile card edit button.",
    visual: "profile",
  },
  {
    id: "profile-save",
    tab: "profile",
    target: "[data-onboarding='profile-card']",
    icon: CheckCircle2,
    eyebrow: "2. Save",
    title: "Lock in the first change",
    body: "After editing, save the profile. The checklist on the right helps you see what is still missing before publishing.",
    action: "Save when the profile looks right.",
    visual: "save",
  },
  {
    id: "links-overview",
    tab: "links",
    target: "[data-onboarding='links-toolbar']",
    icon: Link,
    eyebrow: "3. Links",
    title: "Build the public order",
    body: "Links are the public cards people click. Normal links, smart CTAs, lists, text cards, and separators can live together in one ordered stack.",
    action: "Review the content toolbar.",
    visual: "links",
  },
  {
    id: "links-first-card",
    tab: "links",
    target: "[data-onboarding='link-add-grid']",
    icon: MousePointerClick,
    eyebrow: "4. First card",
    title: "Add one useful action",
    body: "Create the first link or CTA. CTAs are best for actions like booking, buying, subscribing, downloading, or contacting you.",
    action: "Choose Link, CTA, Text, List, or Separator.",
    visual: "cards",
  },
  {
    id: "theme-overview",
    tab: "theme",
    target: "[data-onboarding='theme-customizer']",
    icon: Palette,
    eyebrow: "5. Theme",
    title: "Shape the look",
    body: "Use Theme to tune colors, typography, layout, and background. Changes preview immediately, so you can test the feel before saving.",
    action: "Start with colors, then adjust spacing.",
    visual: "theme",
  },
  {
    id: "public-page",
    target: "[data-onboarding='public-page']",
    icon: ExternalLink,
    eyebrow: "6. Publish check",
    title: "Open the public page",
    body: "Once the basics are saved, open the public page and check it like a visitor would: profile, first action, visual rhythm, and mobile fit.",
    action: "Open Public page in a new tab.",
    visual: "public",
  },
];

function getInitialMode(forceOpen?: boolean): OnboardingMode {
  if (forceOpen || forcedByEnv) return "welcome";
  if (typeof window === "undefined") return "hidden";

  try {
    if (window.localStorage.getItem(FORCE_STORAGE_KEY) === "true") return "welcome";
    if (window.localStorage.getItem(STORAGE_KEY) === "true") return "hidden";
  } catch {
    return "hidden";
  }

  return "welcome";
}

function markCompleted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

export const AdminOnboarding = ({ activeTab, visibleTabs, onSelectTab, forceOpen }: AdminOnboardingProps) => {
  const [mode, setMode] = useState<OnboardingMode>(() => getInitialMode(forceOpen));
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(
    () => tourSteps.filter(step => !step.tab || visibleTabs.includes(step.tab)),
    [visibleTabs],
  );
  const step = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];
  const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;

  useEffect(() => {
    if (forceOpen || forcedByEnv) {
      setMode(current => (current === "hidden" ? "welcome" : current));
    }
  }, [forceOpen]);

  useEffect(() => {
    if (mode !== "tour" || !step) return;
    if (step.tab && activeTab !== step.tab) {
      onSelectTab(step.tab);
    }
  }, [activeTab, mode, onSelectTab, step]);

  useEffect(() => {
    const activeElements = document.querySelectorAll("[data-onboarding-active='true']");
    activeElements.forEach(element => element.removeAttribute("data-onboarding-active"));

    if (mode !== "tour" || !step?.target) return;
    const id = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(step.target || "");
      if (!target) return;
      target.setAttribute("data-onboarding-active", "true");
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }, 120);

    return () => {
      window.clearTimeout(id);
      document
        .querySelectorAll("[data-onboarding-active='true']")
        .forEach(element => element.removeAttribute("data-onboarding-active"));
    };
  }, [mode, step]);

  const close = () => {
    markCompleted();
    setMode("hidden");
  };

  const start = () => {
    setStepIndex(0);
    setMode("tour");
  };

  const next = () => {
    if (stepIndex >= steps.length - 1) {
      close();
      return;
    }
    setStepIndex(index => index + 1);
  };

  const previous = () => {
    setStepIndex(index => Math.max(index - 1, 0));
  };

  if (mode === "hidden" || steps.length === 0) return null;

  if (mode === "minimized") {
    return (
      <button
        type="button"
        className="admin-onboarding-dock"
        onClick={() => setMode("tour")}
        aria-label="Resume onboarding guide"
      >
        <Compass className="h-4 w-4" />
        <span>Guide</span>
      </button>
    );
  }

  if (mode === "welcome") {
    return (
      <aside className="admin-onboarding-welcome" aria-label="OrbitPage onboarding guide">
        <div className="admin-onboarding-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="admin-onboarding-welcome-copy">
          <span className="admin-onboarding-kicker">Quick start</span>
          <h2>Build the first useful version of your page.</h2>
          <p>
            A short animated guide will walk through profile, first content card, theme, and final public check.
          </p>
        </div>
        <div className="admin-onboarding-map" aria-hidden="true">
          <MiniVisual type="profile" />
          <MiniVisual type="cards" />
          <MiniVisual type="theme" />
        </div>
        <div className="admin-onboarding-roadmap">
          <span>Profile first</span>
          <span>Add your first card</span>
          <span>Shape the look</span>
        </div>
        <div className="admin-onboarding-actions">
          <Button className="admin-action admin-action-primary" size="sm" onClick={start}>
            <Play className="h-4 w-4" />
            Start guide
          </Button>
          <Button className="admin-action" variant="outline" size="sm" onClick={close}>
            Skip
          </Button>
        </div>
      </aside>
    );
  }

  const Icon = step.icon;

  return (
    <>
      <div className="admin-onboarding-shade" aria-hidden="true" />
      <aside className="admin-onboarding-panel" aria-label="OrbitPage onboarding guide">
        <div className="admin-onboarding-panel-top">
          <div className="admin-onboarding-step-icon">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="admin-onboarding-kicker">{step.eyebrow}</p>
            <h2>{step.title}</h2>
          </div>
          <div className="admin-onboarding-window-actions">
            <button type="button" onClick={() => setMode("minimized")} aria-label="Minimize guide">
              <Minimize2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={close} aria-label="Skip guide">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <MiniVisual type={step.visual} />

        <p className="admin-onboarding-body">{step.body}</p>
        <div className="admin-onboarding-instruction">
          <MousePointerClick className="h-4 w-4" />
          <span>{step.action}</span>
        </div>

        <div className="admin-onboarding-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="admin-onboarding-footer">
          <span>{stepIndex + 1} of {steps.length}</span>
          <div className="flex items-center gap-2">
            <Button className="admin-action" variant="outline" size="sm" onClick={previous} disabled={stepIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button className="admin-action admin-action-primary" size="sm" onClick={next}>
              {stepIndex >= steps.length - 1 ? "Done" : "Next"}
              {stepIndex < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

function MiniVisual({ type }: { type: TourStep["visual"] }) {
  return (
    <div className={`admin-onboarding-visual admin-onboarding-visual-${type}`}>
      <div className="admin-onboarding-visual-toolbar">
        <span />
        <span />
        <span />
      </div>
      {type === "profile" && (
        <div className="admin-onboarding-visual-profile">
          <span className="avatar" />
          <span className="line strong" />
          <span className="line" />
          <div className="socials"><i /><i /><i /></div>
        </div>
      )}
      {type === "save" && (
        <div className="admin-onboarding-visual-save">
          <span className="field" />
          <span className="field small" />
          <span className="button" />
        </div>
      )}
      {type === "links" && (
        <div className="admin-onboarding-visual-links">
          <span className="row" />
          <span className="row accent" />
          <span className="row" />
        </div>
      )}
      {type === "cards" && (
        <div className="admin-onboarding-visual-cards">
          <span>Link</span>
          <span>CTA</span>
          <span>Text</span>
          <span>List</span>
        </div>
      )}
      {type === "theme" && (
        <div className="admin-onboarding-visual-theme">
          <span className="swatch blue" />
          <span className="swatch green" />
          <span className="swatch ink" />
          <span className="range" />
        </div>
      )}
      {type === "public" && (
        <div className="admin-onboarding-visual-public">
          <span className="phone">
            <i />
            <i />
            <i />
          </span>
          <span className="arrow" />
        </div>
      )}
    </div>
  );
}
