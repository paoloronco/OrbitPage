import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import {
  ADMIN_ONBOARDING_FORCE_STORAGE_KEY,
  ADMIN_ONBOARDING_SESSION_DISMISSED_KEY,
  ADMIN_ONBOARDING_STORAGE_KEY,
} from "@/lib/admin-onboarding-storage";
import {
  BarChart2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  ExternalLink,
  FileText,
  Key,
  Link,
  Minimize2,
  MousePointerClick,
  Palette,
  Play,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

type AdminOnboardingTab = "profile" | "links" | "theme" | "access" | "backup" | "analytics" | "privacy" | "txt";
type OnboardingMode = "hidden" | "welcome" | "tour" | "minimized";

interface AdminOnboardingProfile {
  name?: string;
  bio?: string;
  googleAnalyticsId?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
}

interface AdminOnboardingProps {
  activeTab: AdminOnboardingTab;
  visibleTabs: AdminOnboardingTab[];
  onSelectTab: (tab: AdminOnboardingTab) => void;
  forceOpen?: boolean;
  repeatEnabled?: boolean;
  profile?: AdminOnboardingProfile;
  savedLinkCount?: number;
  themeSaved?: boolean;
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
  required?: boolean;
  doneLabel: string;
  waitingLabel?: string;
  checklist: string[];
}

const forcedByEnv = import.meta.env.VITE_FORCE_ADMIN_ONBOARDING === "true" || import.meta.env.VITE_FORCE_ADMIN_ONBOARDING === "1";

const tourSteps: TourStep[] = [
  {
    id: "profile-basics",
    tab: "profile",
    target: "[data-onboarding='profile-card']",
    icon: User,
    eyebrow: "1. Page",
    title: "Complete the public profile",
    body: "This is the card visitors see first. Edit it, enter the public name and a short description, then press Save inside the profile card.",
    action: "Click the pencil on the profile card, add name and description, then save.",
    required: true,
    doneLabel: "Profile saved",
    waitingLabel: "Waiting for name and description to be saved",
    checklist: ["Click the profile edit pencil", "Enter the public name", "Add a short description", "Press Save"],
  },
  {
    id: "onboarding-settings",
    tab: "profile",
    target: "[data-onboarding='onboarding-settings']",
    icon: Compass,
    eyebrow: "2. Guide control",
    title: "Decide if the guide should reopen",
    body: "Use this box when a new customer is learning the dashboard. Keep the guide enabled while onboarding; turn it off when they no longer need it at every login.",
    action: "Use Start guide to replay it, or switch off Show at every login.",
    doneLabel: "Guide controls reviewed",
    checklist: ["Start guide replays this flow", "Show at every login is saved for the whole instance", "Disable it when onboarding is complete"],
  },
  {
    id: "links-first-card",
    tab: "links",
    target: "[data-onboarding='link-add-grid']",
    icon: Link,
    eyebrow: "3. Links",
    title: "Create and save the first public card",
    body: "This grid creates the blocks shown on the public page. Add a Link, CTA, Text/List, or Separator, fill the card, then press Save in the toolbar.",
    action: "Add at least one card and press the Links Save button.",
    required: true,
    doneLabel: "First card saved",
    waitingLabel: "Waiting for a saved link, CTA, text card, list, or separator",
    checklist: ["Choose a card type", "Fill the title and URL if needed", "Use CTA for actions like Book or Contact", "Press Save in the Links toolbar"],
  },
  {
    id: "links-save",
    tab: "links",
    target: "[data-onboarding='links-toolbar']",
    icon: MousePointerClick,
    eyebrow: "4. Content order",
    title: "Use the Links toolbar as the publish checkpoint",
    body: "Changes in Links stay local until Save is pressed. This protects public pages from accidental edits while cards are reordered or drafted.",
    action: "Check the Unsaved changes badge and save before leaving Links.",
    doneLabel: "Save behavior understood",
    checklist: ["Drag cards to change order", "Watch for Unsaved changes", "Save only when the public order is ready"],
  },
  {
    id: "theme-save",
    tab: "theme",
    target: "[data-onboarding='theme-customizer']",
    icon: Palette,
    eyebrow: "5. Theme",
    title: "Tune the visual style and save it",
    body: "Theme controls affect the public page look. Make a small color, typography, layout, or background adjustment, preview it, then press Save Changes.",
    action: "Adjust one theme setting and save the theme.",
    required: true,
    doneLabel: "Theme saved in this session",
    waitingLabel: "Waiting for Save Changes in Theme",
    checklist: ["Start with Colors", "Preview the change", "Check spacing or background", "Press Save Changes"],
  },
  {
    id: "analytics",
    tab: "analytics",
    target: "[data-onboarding='analytics-section']",
    icon: BarChart2,
    eyebrow: "6. Analytics",
    title: "Understand clicks and optional GA4",
    body: "Analytics shows total clicks, CTA clicks, and top-performing cards. If the customer uses Google Analytics 4, add the Measurement ID here.",
    action: "Review click metrics and optionally save a GA4 Measurement ID.",
    doneLabel: "Analytics reviewed",
    checklist: ["Check Total clicks", "Check CTA clicks", "Add GA4 only if available"],
  },
  {
    id: "access",
    tab: "access",
    target: "[data-onboarding='access-section']",
    icon: Key,
    eyebrow: "7. Access",
    title: "Review users, backups, and password tools",
    body: "Access is where admins manage users, export backups, restore data, and change the admin password. This is the operational safety area.",
    action: "Confirm who can access the admin and where backups are handled.",
    doneLabel: "Access reviewed",
    checklist: ["Review existing users", "Know where backups live", "Change password only when needed"],
  },
  {
    id: "backup",
    tab: "backup",
    target: "[data-onboarding='backup-section']",
    icon: Database,
    eyebrow: "7. Backup",
    title: "Keep a portable copy of the managed page",
    body: "Download the current profile, blocks, theme, privacy settings, and managed media references. Restoring affects only this signed-in workspace; account and billing data stay untouched.",
    action: "Download a backup now and keep it somewhere you control.",
    doneLabel: "Backup tools reviewed",
    checklist: ["Download the JSON backup", "Keep it outside OrbitPage", "Restore only into the intended workspace"],
  },
  {
    id: "privacy",
    tab: "privacy",
    target: "[data-onboarding='privacy-section']",
    icon: ShieldCheck,
    eyebrow: "8. Privacy",
    title: "Set legal links and consent behavior",
    body: "Privacy controls decide which policy links appear publicly and whether consent management is active. This should match the customer legal setup.",
    action: "Add Privacy/Cookie links or configure hosted policies if required.",
    doneLabel: "Privacy reviewed",
    checklist: ["Choose hosted or external policies", "Save Privacy Policy and Cookie Policy links", "Review consent mode if tracking is used"],
  },
  {
    id: "txt",
    tab: "txt",
    target: "[data-onboarding='txt-section']",
    icon: FileText,
    eyebrow: "9. TXT",
    title: "Check crawler and AI-facing text files",
    body: "TXT files control crawler hints, LLM-facing instructions, humans.txt, security.txt, and related public metadata.",
    action: "Review defaults and edit only when the customer has specific SEO or AI-indexing needs.",
    doneLabel: "TXT reviewed",
    checklist: ["Review robots.txt", "Review llms.txt", "Edit security.txt if needed"],
  },
  {
    id: "public-page",
    target: "[data-onboarding='public-page']",
    icon: ExternalLink,
    eyebrow: "10. Final check",
    title: "Open the public page like a visitor",
    body: "After setup, open the public page and verify the profile, first card, CTA style, policy links, and mobile layout.",
    action: "Click Public page and inspect the result in a new tab.",
    doneLabel: "Ready for public review",
    checklist: ["Open Public page", "Check profile and first action", "Check visual theme", "Check footer/legal links"],
  },
];

function getInitialMode(forceOpen?: boolean, repeatEnabled?: boolean): OnboardingMode {
  if (forceOpen || forcedByEnv) return "welcome";
  if (typeof window === "undefined") return repeatEnabled ? "welcome" : "hidden";

  try {
    if (window.sessionStorage.getItem(ADMIN_ONBOARDING_SESSION_DISMISSED_KEY) === "true") return "hidden";
    if (window.localStorage.getItem(ADMIN_ONBOARDING_FORCE_STORAGE_KEY) === "true") return "welcome";
    if (window.localStorage.getItem(ADMIN_ONBOARDING_STORAGE_KEY) === "true") return "hidden";
  } catch {
    return "hidden";
  }

  return repeatEnabled ? "welcome" : "hidden";
}

function setSessionDismissed(dismissed: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (dismissed) window.sessionStorage.setItem(ADMIN_ONBOARDING_SESSION_DISMISSED_KEY, "true");
    else window.sessionStorage.removeItem(ADMIN_ONBOARDING_SESSION_DISMISSED_KEY);
  } catch {
    // sessionStorage can be unavailable in private or restricted contexts.
  }
}

function markCompleted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

export const AdminOnboarding = ({
  activeTab,
  visibleTabs,
  onSelectTab,
  forceOpen,
  repeatEnabled = true,
  profile,
  savedLinkCount = 0,
  themeSaved = false,
}: AdminOnboardingProps) => {
  const [mode, setMode] = useState<OnboardingMode>(() => getInitialMode(forceOpen, repeatEnabled));
  const [stepIndex, setStepIndex] = useState(0);
  const [dismissedThisSession, setDismissedThisSession] = useState(() => getInitialMode(forceOpen, repeatEnabled) === "hidden");

  const steps = useMemo(
    () => tourSteps.filter(step => !step.tab || visibleTabs.includes(step.tab)),
    [visibleTabs],
  );
  const step = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))];
  const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;

  const profileComplete = Boolean(profile?.name?.trim() && profile?.bio?.trim());
  const stepComplete = !step?.required ||
    (step.id === "profile-basics" && profileComplete) ||
    (step.id === "links-first-card" && savedLinkCount > 0) ||
    (step.id === "theme-save" && themeSaved);

  useEffect(() => {
    if (forceOpen || forcedByEnv) {
      setMode(current => (current === "hidden" ? "welcome" : current));
    }
  }, [forceOpen]);

  useEffect(() => {
    if (repeatEnabled && !dismissedThisSession && mode === "hidden") {
      setMode("welcome");
    }
  }, [dismissedThisSession, mode, repeatEnabled]);

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
    }, 180);

    return () => {
      window.clearTimeout(id);
      document
        .querySelectorAll("[data-onboarding-active='true']")
        .forEach(element => element.removeAttribute("data-onboarding-active"));
    };
  }, [mode, step]);

  const close = () => {
    if (!repeatEnabled) markCompleted();
    setSessionDismissed(true);
    setDismissedThisSession(true);
    setMode("hidden");
  };

  const start = () => {
    setSessionDismissed(false);
    setDismissedThisSession(false);
    setStepIndex(0);
    setMode("tour");
  };

  const next = () => {
    if (!stepComplete) return;
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
          <span className="admin-onboarding-kicker">Guided setup</span>
          <h2>Set up the page by doing the real first actions.</h2>
          <p>
            The guide will move through every admin area. Core steps wait until the profile, first content card, and theme are actually saved.
          </p>
        </div>
        <div className="admin-onboarding-roadmap admin-onboarding-roadmap-grid">
          <span>Page profile</span>
          <span>First card</span>
          <span>Theme save</span>
          <span>Analytics</span>
          {visibleTabs.includes("access") && <span>Access</span>}
          {visibleTabs.includes("backup") && <span>Backup</span>}
          <span>Privacy</span>
          <span>TXT</span>
          <span>Public check</span>
        </div>
        {repeatEnabled && (
          <p className="admin-onboarding-repeat-note">
            This guide is enabled at every login. Turn it off from Page, Guided setup when onboarding is complete.
          </p>
        )}
        <div className="admin-onboarding-actions">
          <Button className="admin-action admin-action-primary" size="sm" onClick={start}>
            <Play className="h-4 w-4" />
            Start setup
          </Button>
          <Button className="admin-action" variant="outline" size="sm" onClick={close}>
            Skip for now
          </Button>
        </div>
      </aside>
    );
  }

  const Icon = step.icon;
  const statusLabel = stepComplete ? step.doneLabel : (step.waitingLabel || "Waiting for this step");

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

        <div className="admin-onboarding-focus-card">
          <div className="admin-onboarding-focus-heading">
            <span>{step.target ? "Highlighted now" : "Current task"}</span>
            <strong>{step.action}</strong>
          </div>
          <ul>
            {step.checklist.map(item => (
              <li key={item}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="admin-onboarding-body">{step.body}</p>
        <div className={stepComplete ? "admin-onboarding-instruction admin-onboarding-instruction-done" : "admin-onboarding-instruction"}>
          {stepComplete ? <CheckCircle2 className="h-4 w-4" /> : <MousePointerClick className="h-4 w-4" />}
          <span>{statusLabel}</span>
        </div>

        <div className="admin-onboarding-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="admin-onboarding-footer">
          <span>{stepIndex + 1} of {steps.length}</span>
          <div className="admin-onboarding-footer-actions flex items-center gap-2">
            <Button className="admin-action" variant="ghost" size="sm" onClick={close}>
              Skip
            </Button>
            <Button className="admin-action" variant="outline" size="sm" onClick={previous} disabled={stepIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button className="admin-action admin-action-primary" size="sm" onClick={next} disabled={!stepComplete}>
              {stepIndex >= steps.length - 1 ? "Done" : "Next"}
              {stepComplete && stepIndex < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};
