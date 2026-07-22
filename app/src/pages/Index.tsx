import { useState, useEffect, useLayoutEffect } from "react";
import { PublicView } from "@/components/PublicView";
import { CookieBanner } from "@/components/CookieBanner";
import { BackgroundLayer } from "@/components/BackgroundLayer";
import { LinkData } from "@/components/LinkCard";
import { applyTheme, normalizeTheme, BackgroundMediaConfig, type ThemeConfig } from "@/lib/theme";
import { publicPageApi, consentConfigPublicApi, type ConsentConfigData, type PublicPageResponse } from "@/lib/api-client";
import { consentManager } from "@/lib/consent-manager";
import { normalizeLinkDtos } from "@/lib/link-normalization";
import { getEffectivePrivacyPolicyUrl } from "@/config/legal";
import profileAvatar from "@/assets/profile-avatar.jpg";
import { internalAssetPath, withBasePath } from "@/lib/base-path";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import { isBundledProfileAvatar } from "@/lib/profile-avatar";
import { trackPublicPageView } from "@/lib/public-runtime";
import { UnderConstruction } from "@/components/UnderConstruction";
import { collectCriticalPublicImageUrls, waitForCriticalPublicImages } from "@/lib/public-asset-readiness";

interface ProfileData {
  name: string;
  bio: string;
  avatar: string;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    discord?: string;
    telegram?: string;
    whatsapp?: string;
    mastodon?: string;
  };
  showAvatar?: boolean;
  nameFontSize?: string;
  bioFontSize?: string;
  appearance?: ProfileAppearance;
  footerText?: string;
  favicon?: string;
  googleAnalyticsId?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
}

declare global {
  interface Window {
    __ORBITPAGE_STATIC_SNAPSHOT__?: {
      page: PublicPageResponse;
      menu?: unknown;
      consentConfig?: ConsentConfigData;
    };
  }
}

function faviconHref(value: string) {
  if (/^(?:https?:|data:image\/|blob:)/i.test(value)) return value;
  if (value.startsWith('/') || /\.(?:png|jpe?g|gif|webp|ico|svg)(?:\?.*)?$/i.test(value)) {
    return internalAssetPath(value) || withBasePath('/brand/orbitpage-mark.svg');
  }
  const escapedValue = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${escapedValue}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    bio: "",
    avatar: profileAvatar,
    showAvatar: false,
  });
  const [links, setLinks] = useState<LinkData[]>([]);
  const [backgroundMedia, setBackgroundMedia] = useState<BackgroundMediaConfig | null>(null);
  const [theme, setTheme] = useState<ThemeConfig>(() => normalizeTheme(null));
  // Consent config drives whether CookieBanner is rendered
  const [consentConfig, setConsentConfig] = useState<ConsentConfigData | null>(null);
  const [showOrbitPageBadge, setShowOrbitPageBadge] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  // Reveal the static page only after React has committed the final snapshot.
  // This prevents a frame containing avatar initials or placeholder card icons.
  useLayoutEffect(() => {
    if (loading) return;
    const frame = window.requestAnimationFrame(() => {
      document.body.classList.remove('orbitpage-booting');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading]);

  // Load all public page data in one request so the default UI never flashes.
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const staticSnapshot = window.__ORBITPAGE_STATIC_SNAPSHOT__;
        const [pageData, consentRes] = staticSnapshot
          ? [
              staticSnapshot.page,
              { data: staticSnapshot.consentConfig || { mode: 'disabled' as const, enabled: false } },
            ]
          : await Promise.all([
              publicPageApi.get(),
              consentConfigPublicApi.get().catch(() => ({ data: { mode: 'disabled' as const, enabled: false } })),
            ]);
        if (cancelled) return;

        // Initialise consent manager with backend config.
        // Must happen early so registerConsentDependentScript() below works correctly.
        const cfg = consentRes?.data ?? { mode: 'disabled' as const, enabled: false };
        consentManager.init(cfg as ConsentConfigData);
        setConsentConfig(cfg as ConsentConfigData);

        const loadedTheme = normalizeTheme(pageData.theme);
        const normalizedLinks = normalizeLinkDtos(pageData.links);
        applyTheme(loadedTheme);
        setTheme(loadedTheme);
        setBackgroundMedia(loadedTheme.backgroundMedia ?? null);
        setSetupRequired(pageData.setupRequired === true);

        // In builder mode, inject the external CMP script immediately after init
        // so consent wiring is in place before any consent-dependent scripts are registered.
        // This must happen before the GA registerConsentDependentScript call below.
        if (cfg.mode === 'builder' && cfg.enabled) {
          consentManager.injectBuilderScript();
        }

        const profileData = pageData.profile;
        let nextProfile: ProfileData | null = null;
        if (profileData) {
          const footerText = (profileData as any).footer_text || (profileData as any).footerText || undefined;
          const faviconValue = (profileData as any).favicon;
          const favicon = isBundledProfileAvatar(faviconValue) ? undefined : (faviconValue || undefined);
          const googleAnalyticsId = (profileData as any).google_analytics_id || (profileData as any).googleAnalyticsId || undefined;
          const configuredPrivacyPolicyUrl = (profileData as any).privacy_policy_url || (profileData as any).privacyPolicyUrl || undefined;
          const privacyPolicyUrl = getEffectivePrivacyPolicyUrl(configuredPrivacyPolicyUrl);
          const cookiePolicyUrl = (profileData as any).cookie_policy_url || (profileData as any).cookiePolicyUrl || undefined;
          nextProfile = {
            name: profileData.name || "",
            bio: profileData.bio || "",
            avatar: profileData.avatar && !isBundledProfileAvatar(profileData.avatar)
              ? profileData.avatar
              : (profileAvatar as string),
            showAvatar: typeof (profileData as any).show_avatar !== 'undefined'
              ? (profileData as any).show_avatar !== 0
              : ((profileData as any).showAvatar ?? true),
            nameFontSize: (profileData as any).name_font_size || (profileData as any).nameFontSize || undefined,
            bioFontSize: (profileData as any).bio_font_size || (profileData as any).bioFontSize || undefined,
            appearance: (profileData as any).appearance || {},
            socialLinks: profileData.social_links || (profileData as any).socialLinks || {},
            footerText,
            favicon,
            googleAnalyticsId,
            privacyPolicyUrl,
            cookiePolicyUrl,
          };
          setProfile(nextProfile);

          // ── Google Analytics 4 — Consent Mode v2 ────────────────────────────
          // gtag.js is intentionally NOT loaded at page-load (neither server-side nor
          // client-side). Loading it early — even with GCM v2 defaults denied — causes
          // cookieless pings to fire before consent in basic mode.
          //
          // Instead we:
          //   1. Keep the GA property disabled while analytics consent is absent
          //   2. Register the gtag.js load + gtag('config') call as a consent-dependent
          //      action — it only runs once the visitor grants analytics consent.
          if (googleAnalyticsId && typeof googleAnalyticsId === 'string' && googleAnalyticsId.match(/^G-[A-Z0-9]+$/i)) {
            const win = window as any;

            // Load gtag.js and call config ONLY after analytics consent is granted.
            // No GA network request of any kind is made before this callback fires.
            const gaId = googleAnalyticsId;
            const gaDisableKey = `ga-disable-${gaId}`;
            const syncGaDisabled = () => {
              win[gaDisableKey] = !consentManager.isGranted('analytics');
            };
            syncGaDisabled();
            win.__orbitpageGaConsentUnsubscribe?.();
            win.__orbitpageGaConsentUnsubscribe = consentManager.onConsentChange(syncGaDisabled);

            consentManager.registerConsentDependentScript('analytics', () => {
              if (!consentManager.isGranted('analytics')) return;
              win[gaDisableKey] = false;
              consentManager.ensureGoogleConsentDefaults();
              if (typeof win.gtag !== 'function') {
                win.dataLayer = win.dataLayer || [];
                win.gtag = function () { win.dataLayer.push(arguments); };
              }
              if (!document.getElementById('orbitpage-ga-script')) {
                const script = document.createElement('script');
                script.id = 'orbitpage-ga-script';
                script.async = true;
                // data-cookieconsent tells Cookiebot auto-blocking to allow this script
                // when the visitor has granted statistics consent.
                script.setAttribute('data-cookieconsent', 'statistics');
                script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
                document.head.appendChild(script);
              }
              win.gtag?.('js', new Date());
              win.gtag?.('config', gaId);
            });
          }

          // Apply document title
          const tabTitle = (profileData as any).tab_title || (profileData as any).tabTitle;
          if (tabTitle && typeof tabTitle === 'string') {
            document.title = tabTitle;
          }
          // Apply meta description
          const metaDesc = (profileData as any).meta_description || (profileData as any).metaDescription;
          if (metaDesc && typeof metaDesc === 'string') {
            let tag = document.querySelector('meta[name="description"]');
            if (!tag) {
              tag = document.createElement('meta');
              tag.setAttribute('name', 'description');
              document.head.appendChild(tag);
            }
            tag.setAttribute('content', metaDesc);
          }
          // Apply the uploaded profile logo as the browser favicon.
          if (favicon && typeof favicon === 'string') {
            document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']").forEach((icon) => icon.remove());
            const href = faviconHref(favicon);
            const link = document.createElement('link');
            link.rel = 'icon';
            link.href = href;
            if (link.href.startsWith('data:image/svg+xml')) link.type = 'image/svg+xml';
            document.head.appendChild(link);

            let touchIcon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
            if (!touchIcon) {
              touchIcon = document.createElement('link');
              touchIcon.rel = 'apple-touch-icon';
              document.head.appendChild(touchIcon);
            }
            touchIcon.href = href;
          }
        }

        setLinks(normalizedLinks);
        if (pageData.setupRequired !== true) trackPublicPageView();
        setShowOrbitPageBadge(pageData.branding?.showOrbitPageBadge !== false);
        if (pageData.setupRequired === true) document.title = "Page under construction | OrbitPage";
        await waitForCriticalPublicImages(collectCriticalPublicImageUrls({
          avatar: nextProfile?.avatar,
          showAvatar: nextProfile?.showAvatar,
          links: normalizedLinks,
          backgroundMedia: loadedTheme.backgroundMedia,
        }));
        if (cancelled) return;
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        if (!cancelled) {
          setLoadFailed(true);
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || loadFailed) return null;
  if (setupRequired) return <UnderConstruction />;

  // Merge profile-level policy URLs into the consent config so the banner and footer
  // always use the same canonical URLs — no provider-specific IDs hardcoded anywhere.
  const bannerConfig = consentConfig?.hardcoded
    ? {
        ...consentConfig,
        hardcoded: {
          ...consentConfig.hardcoded,
          urls: {
            privacyPolicy: profile.privacyPolicyUrl ? withBasePath(profile.privacyPolicyUrl) : '',
            cookiePolicy: profile.cookiePolicyUrl ? withBasePath(profile.cookiePolicyUrl) : '',
          },
        },
      }
    : consentConfig;

  const resolvePolicyUrl = (kind: 'privacy' | 'cookie'): string | undefined => {
    const profileUrl = kind === 'privacy'
      ? profile.privacyPolicyUrl
      : profile.cookiePolicyUrl;
    const fallback = kind === 'privacy' ? '/privacy' : '/cookies';

    if (profileUrl && profileUrl.trim()) {
      return profileUrl.trim();
    }

    const policy = consentConfig?.legalPolicies?.[kind === 'privacy' ? 'privacyPolicy' : 'cookiePolicy'];
    if (!policy) return fallback;
    if (policy.mode === 'external') {
      return policy.externalUrl?.trim() || fallback;
    }
    return fallback;
  };

  const privacyPolicyUrl = resolvePolicyUrl('privacy');
  const cookiePolicyUrl = resolvePolicyUrl('cookie');
  const ccpaPolicyUrl = privacyPolicyUrl || cookiePolicyUrl;

  return (
    <>
      {backgroundMedia && (
        <BackgroundLayer config={backgroundMedia} />
      )}
      <PublicView
        profile={profile}
        links={links}
        theme={theme}
        footerText={profile.footerText}
        privacyPolicyUrl={privacyPolicyUrl}
        cookiePolicyUrl={cookiePolicyUrl}
        ccpaPolicyUrl={ccpaPolicyUrl}
        showOrbitPageBadge={showOrbitPageBadge}
      />
      {/* Render the native banner only when mode === 'hardcoded'.
          Builder mode: external CMP injects its own UI via injectBuilderScript().
          Disabled mode: no banner rendered. */}
      {consentConfig?.mode === 'hardcoded' && consentConfig.enabled && bannerConfig && (
        <CookieBanner config={bannerConfig} />
      )}
    </>
  );
};

export default Index;
