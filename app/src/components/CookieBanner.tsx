/**
 * CookieBanner.tsx — OrbitPage native cookie consent banner
 *
 * Renders:
 *  1. The main consent banner (bottom-bar / centered-modal / corner-popup)
 *  2. The preferences modal (always a centered overlay)
 *  3. A persistent "Cookie preferences" reopener chip in the bottom-left corner
 *
 * Compliance notes:
 *  - "Reject all" and "Accept all" receive identical visual weight (EU/GDPR requirement)
 *  - No consent by inaction, scrolling, or pre-ticked optional categories
 *  - Necessary cookies are pre-checked and locked (cannot be disabled)
 *  - The reopener chip is always visible after consent is given so users can
 *    revise their choices at any time (GDPR Art. 7 withdrawal requirement)
 */

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import {
  consentManager,
  type ConsentCategory,
  type ConsentConfig,
  type HardcodedBannerConfig,
} from '@/lib/consent-manager';

// ── Props ─────────────────────────────────────────────────────────────────────

interface CookieBannerProps {
  /** Full consent config fetched from /api/consent-config/public */
  config: ConsentConfig;
}

// ── Theme helper ──────────────────────────────────────────────────────────────

function resolveTheme(cfg: HardcodedBannerConfig): 'light' | 'dark' {
  if (cfg.theme === 'dark') return 'dark';
  if (cfg.theme === 'light') return 'light';
  // auto — follow system preference
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

// ── CSS-in-JS palette (avoids Tailwind purging issues for dynamic classes) ───

const palette = {
  light: {
    bg:        '#ffffff',
    surface:   '#f8fafc',
    border:    '#e2e8f0',
    text:      '#0f172a',
    muted:     '#64748b',
    accent:    '#2563eb',
    accentFg:  '#ffffff',
    overlay:   'rgba(15,23,42,0.5)',
    badge:     '#dcfce7',
    badgeText: '#166534',
  },
  dark: {
    bg:        '#1e293b',
    surface:   '#0f172a',
    border:    '#334155',
    text:      '#f1f5f9',
    muted:     '#94a3b8',
    accent:    '#3b82f6',
    accentFg:  '#ffffff',
    overlay:   'rgba(0,0,0,0.65)',
    badge:     '#14532d',
    badgeText: '#86efac',
  },
} as const;

// ── Sub-components ────────────────────────────────────────────────────────────

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  colors: typeof palette['light'];
  style?: React.CSSProperties;
}
function Btn({ onClick, children, primary, colors, style }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem 1.125rem',
        borderRadius: '0.5rem',
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.4,
        cursor: 'pointer',
        border: primary ? 'none' : `1.5px solid ${colors.border}`,
        background: primary ? colors.accent : colors.bg,
        color: primary ? colors.accentFg : colors.text,
        transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

interface ToggleProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  colors: typeof palette['light'];
}
function Toggle({ id, checked, disabled, onChange, colors }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? colors.accent : colors.border,
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

// ── Preferences Modal ─────────────────────────────────────────────────────────

interface PreferencesModalProps {
  cfg: HardcodedBannerConfig;
  colors: typeof palette['light'];
  onClose: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSave: (cats: Partial<Record<ConsentCategory, boolean>>) => void;
}

function PreferencesModal({
  cfg, colors, onClose, onAcceptAll, onRejectAll, onSave,
}: PreferencesModalProps) {
  const existing = consentManager.getConsent();
  const [selected, setSelected] = useState<Partial<Record<ConsentCategory, boolean>>>({
    preferences: existing?.categories.preferences ?? false,
    analytics:   existing?.categories.analytics   ?? false,
    marketing:   existing?.categories.marketing   ?? false,
  });

  const toggle = (cat: ConsentCategory) =>
    setSelected((prev) => ({ ...prev, [cat]: !prev[cat] }));

  // Focus trap
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    el.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const optionalCats = (
    ['preferences', 'analytics', 'marketing'] as ConsentCategory[]
  ).filter((c) => cfg.categories[c as keyof typeof cfg.categories]?.enabled);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.overlay,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Cookie preferences"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: '1rem',
          width: '100%',
          maxWidth: 540,
          maxHeight: '90vh',
          overflowY: 'auto',
          outline: 'none',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.5rem 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <div>
            <h2 style={{
              margin: 0, fontSize: '1.125rem', fontWeight: 700,
              color: colors.text, lineHeight: 1.3,
            }}>
              {cfg.texts.managePreferences}
            </h2>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: colors.muted, lineHeight: 1.6 }}>
              Toggle each category below. Your choice is saved locally and never shared.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.muted, fontSize: '1.25rem', lineHeight: 1, flexShrink: 0,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Categories */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Necessary — always on */}
          <CategoryRow
            id="cat-necessary"
            title="Necessary"
            description="Essential for the website to function correctly. Cannot be disabled."
            checked
            disabled
            alwaysActive
            colors={colors}
            onToggle={() => {}}
          />

          {optionalCats.map((cat) => {
            const catCfg = cfg.categories[cat as keyof typeof cfg.categories];
            return (
              <CategoryRow
                key={cat}
                id={`cat-${cat}`}
                title={catCfg.title || cat}
                description={catCfg.description}
                checked={!!selected[cat]}
                disabled={false}
                alwaysActive={false}
                colors={colors}
                onToggle={() => toggle(cat)}
              />
            );
          })}
        </div>

        {/* Legal links */}
        {(cfg.urls.privacyPolicy || cfg.urls.cookiePolicy || cfg.legalFooterText) && (
          <div style={{
            padding: '0 1.5rem 1rem',
            fontSize: '0.75rem',
            color: colors.muted,
            lineHeight: 1.6,
            borderTop: `1px solid ${colors.border}`,
            paddingTop: '0.875rem',
          }}>
            {cfg.legalFooterText && <p style={{ margin: '0 0 0.375rem' }}>{cfg.legalFooterText}</p>}
            <span>
              {cfg.urls.privacyPolicy && (
                <a href={cfg.urls.privacyPolicy} target="_blank" rel="noopener noreferrer"
                  style={{ color: colors.accent, textDecoration: 'none' }}>
                  {cfg.texts.privacyPolicyLinkText || 'Privacy policy'}
                </a>
              )}
              {cfg.urls.privacyPolicy && cfg.urls.cookiePolicy && <span> · </span>}
              {cfg.urls.cookiePolicy && (
                <a href={cfg.urls.cookiePolicy} target="_blank" rel="noopener noreferrer"
                  style={{ color: colors.accent, textDecoration: 'none' }}>
                  {cfg.texts.cookiePolicyLinkText || 'Cookie policy'}
                </a>
              )}
            </span>
          </div>
        )}

        {/* Action buttons — equal weight per GDPR requirement */}
        <div style={{
          padding: '1rem 1.5rem 1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          borderTop: `1px solid ${colors.border}`,
        }}>
          <Btn colors={colors} onClick={onRejectAll}>
            {cfg.texts.rejectAll}
          </Btn>
          <Btn colors={colors} onClick={() => onSave(selected)} primary>
            {cfg.texts.savePreferences}
          </Btn>
          <Btn colors={colors} onClick={onAcceptAll} primary>
            {cfg.texts.acceptAll}
          </Btn>
        </div>
      </div>
    </div>
  );
}

interface CategoryRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  alwaysActive: boolean;
  colors: typeof palette['light'];
  onToggle: () => void;
}
function CategoryRow({
  id, title, description, checked, disabled, alwaysActive, colors, onToggle,
}: CategoryRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '0.625rem',
      padding: '0.875rem 1rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label
            htmlFor={id}
            style={{ fontWeight: 600, fontSize: '0.875rem', color: colors.text, cursor: disabled ? 'default' : 'pointer' }}
          >
            {title}
          </label>
          {alwaysActive && (
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600, padding: '2px 6px',
              background: colors.badge, color: colors.badgeText,
              borderRadius: '9999px', letterSpacing: '0.03em',
            }}>
              Always active
            </span>
          )}
        </div>
        {description && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: colors.muted, lineHeight: 1.6 }}>
            {description}
          </p>
        )}
      </div>
      <Toggle id={id} checked={checked} disabled={disabled} onChange={onToggle} colors={colors} />
    </div>
  );
}

// ── Main Banner layouts ───────────────────────────────────────────────────────

interface BannerBodyProps {
  cfg: HardcodedBannerConfig;
  colors: typeof palette['light'];
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onOpenPrefs: () => void;
  hasOptionalCats: boolean;
}

function BannerBody({ cfg, colors, onAcceptAll, onRejectAll, onOpenPrefs, hasOptionalCats }: BannerBodyProps) {
  const rejectFirst = cfg.buttonPriority === 'reject-first';
  return (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: colors.text, lineHeight: 1.3 }}>
          {cfg.texts.title}
        </p>
        <p style={{ margin: '0.375rem 0 0', fontSize: '0.8125rem', color: colors.muted, lineHeight: 1.6 }}>
          {cfg.texts.description}
          {(cfg.urls.privacyPolicy || cfg.urls.cookiePolicy) && (
            <>
              {' '}
              {cfg.urls.privacyPolicy && (
                <a href={cfg.urls.privacyPolicy} target="_blank" rel="noopener noreferrer"
                  style={{ color: colors.accent, textDecoration: 'underline' }}>
                  {cfg.texts.privacyPolicyLinkText || 'Privacy policy'}
                </a>
              )}
              {cfg.urls.privacyPolicy && cfg.urls.cookiePolicy && <span> · </span>}
              {cfg.urls.cookiePolicy && (
                <a href={cfg.urls.cookiePolicy} target="_blank" rel="noopener noreferrer"
                  style={{ color: colors.accent, textDecoration: 'underline' }}>
                  {cfg.texts.cookiePolicyLinkText || 'Cookie policy'}
                </a>
              )}
            </>
          )}
        </p>
      </div>

      {/* Action buttons — reject is never hidden or de-emphasised */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {rejectFirst ? (
          <>
            <Btn colors={colors} onClick={onRejectAll}>{cfg.texts.rejectAll}</Btn>
            {hasOptionalCats && (
              <Btn colors={colors} onClick={onOpenPrefs}>{cfg.texts.managePreferences}</Btn>
            )}
            <Btn colors={colors} onClick={onAcceptAll} primary>{cfg.texts.acceptAll}</Btn>
          </>
        ) : (
          <>
            {hasOptionalCats && (
              <Btn colors={colors} onClick={onOpenPrefs}>{cfg.texts.managePreferences}</Btn>
            )}
            <Btn colors={colors} onClick={onRejectAll}>{cfg.texts.rejectAll}</Btn>
            <Btn colors={colors} onClick={onAcceptAll} primary>{cfg.texts.acceptAll}</Btn>
          </>
        )}
      </div>
    </>
  );
}

// ── Root Banner Component ─────────────────────────────────────────────────────

export function CookieBanner({ config }: CookieBannerProps) {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const cfg = config.hardcoded;

  // Register UI callbacks with the manager so external code can open the banner/prefs
  useEffect(() => {
    consentManager._registerUICallbacks(
      () => setBannerVisible(true),
      () => setPrefsOpen(true),
    );
  }, []);

  // Determine initial banner visibility on mount
  useEffect(() => {
    if (consentManager.needsBanner()) {
      setBannerVisible(true);
    }
  }, []);

  if (!cfg) return null;

  const theme = resolveTheme(cfg);
  const colors = palette[theme];

  const hasOptionalCats = Object.values(cfg.categories).some((c) => c.enabled);

  const handleAcceptAll = () => {
    consentManager.acceptAll('banner');
    setBannerVisible(false);
    setPrefsOpen(false);
  };

  const handleRejectAll = () => {
    consentManager.rejectAll('banner');
    setBannerVisible(false);
    setPrefsOpen(false);
  };

  const handleSavePrefs = (cats: Partial<Record<ConsentCategory, boolean>>) => {
    consentManager.savePreferences(cats, 'preferences-modal');
    setPrefsOpen(false);
    setBannerVisible(false);
  };

  // ── Layout renderers ────────────────────────────────────────────────────────

  const renderBottomBar = () => (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2147483646,
        background: colors.bg,
        borderTop: `1px solid ${colors.border}`,
        padding: '1rem 1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}
    >
      <BannerBody
        cfg={cfg}
        colors={colors}
        onAcceptAll={handleAcceptAll}
        onRejectAll={handleRejectAll}
        onOpenPrefs={() => setPrefsOpen(true)}
        hasOptionalCats={hasOptionalCats}
      />
    </div>
  );

  const renderCenteredModal = () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.overlay,
        padding: '1rem',
      }}
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="true"
    >
      <div style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '1rem',
        padding: '1.75rem',
        width: '100%',
        maxWidth: 520,
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
      }}>
        <BannerBody
          cfg={cfg}
          colors={colors}
          onAcceptAll={handleAcceptAll}
          onRejectAll={handleRejectAll}
          onOpenPrefs={() => setPrefsOpen(true)}
          hasOptionalCats={hasOptionalCats}
        />
      </div>
    </div>
  );

  const renderCornerPopup = () => (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 2147483646,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '1rem',
        padding: '1.25rem',
        width: 340,
        maxWidth: 'calc(100vw - 2rem)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
      }}
    >
      <BannerBody
        cfg={cfg}
        colors={colors}
        onAcceptAll={handleAcceptAll}
        onRejectAll={handleRejectAll}
        onOpenPrefs={() => setPrefsOpen(true)}
        hasOptionalCats={hasOptionalCats}
      />
    </div>
  );

  // ── Preferences reopener chip ───────────────────────────────────────────────
  // Always visible so users can revise consent at any time (GDPR Art. 7)
  const reopenerChip = !bannerVisible && (
    <button
      type="button"
      onClick={() => setPrefsOpen(true)}
      title={cfg.texts.reopenLabel || 'Cookie preferences'}
      aria-label={cfg.texts.reopenLabel || 'Cookie preferences'}
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        zIndex: 2147483645,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: '9999px',
        padding: '0.375rem 0.75rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: colors.muted,
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        transition: 'box-shadow 0.15s',
      }}
    >
      <span style={{ fontSize: '0.875rem' }}>🍪</span>
      {cfg.texts.reopenLabel || 'Cookie preferences'}
    </button>
  );

  return createPortal(
    <>
      {bannerVisible && !prefsOpen && (() => {
        switch (cfg.layout) {
          case 'centered-modal': return renderCenteredModal();
          case 'corner-popup':   return renderCornerPopup();
          default:               return renderBottomBar();
        }
      })()}

      {prefsOpen && (
        <PreferencesModal
          cfg={cfg}
          colors={colors}
          onClose={() => {
            setPrefsOpen(false);
            // Re-show banner if user closes prefs without saving and consent is still needed
            if (consentManager.needsBanner()) setBannerVisible(true);
          }}
          onAcceptAll={handleAcceptAll}
          onRejectAll={handleRejectAll}
          onSave={handleSavePrefs}
        />
      )}

      {reopenerChip}
    </>,
    document.body,
  );
}
