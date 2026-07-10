import { useState, useEffect } from "react";
import { PublicView } from "@/components/PublicView";
import { CookieBanner } from "@/components/CookieBanner";
import { BackgroundLayer } from "@/components/BackgroundLayer";
import { LinkData } from "@/components/LinkCard";
import { applyTheme, normalizeTheme, BackgroundMediaConfig } from "@/lib/theme";
import { publicPageApi, consentConfigPublicApi, type ConsentConfigData } from "@/lib/api-client";
import { consentManager } from "@/lib/consent-manager";
import { normalizeLinkDtos } from "@/lib/link-normalization";
import { getEffectivePrivacyPolicyUrl } from "@/config/legal";
import profileAvatar from "@/assets/profile-avatar.jpg";
import { withBasePath } from "@/lib/base-path";

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
  footerText?: string;
  favicon?: string;
  googleAnalyticsId?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
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
  // Consent config drives whether CookieBanner is rendered
  const [consentConfig, setConsentConfig] = useState<ConsentConfigData | null>(null);

  // Load all public page data in one request so the default UI never flashes.
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        // Fetch public page data and consent config in parallel
        const [pageData, consentRes] = await Promise.all([
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
        applyTheme(loadedTheme);
        setBackgroundMedia(loadedTheme.backgroundMedia ?? null);

        // In builder mode, inject the external CMP script immediately after init
        // so consent wiring is in place before any consent-dependent scripts are registered.
        // This must happen before the GA registerConsentDependentScript call below.
        if (cfg.mode === 'builder' && cfg.enabled) {
          consentManager.injectBuilderScript();
        }

        const profileData = pageData.profile;
        if (profileData) {
          const footerText = (profileData as any).footer_text || (profileData as any).footerText || undefined;
          const favicon = (profileData as any).favicon || undefined;
          const googleAnalyticsId = (profileData as any).google_analytics_id || (profileData as any).googleAnalyticsId || undefined;
          const configuredPrivacyPolicyUrl = (profileData as any).privacy_policy_url || (profileData as any).privacyPolicyUrl || undefined;
          const privacyPolicyUrl = getEffectivePrivacyPolicyUrl(configuredPrivacyPolicyUrl);
          const cookiePolicyUrl = (profileData as any).cookie_policy_url || (profileData as any).cookiePolicyUrl || undefined;
          setProfile({
            name: profileData.name || "",
            bio: profileData.bio || "",
            avatar: profileData.avatar || (profileAvatar as string),
            showAvatar: typeof (profileData as any).show_avatar !== 'undefined'
              ? (profileData as any).show_avatar !== 0
              : ((profileData as any).showAvatar ?? true),
            nameFontSize: (profileData as any).name_font_size || (profileData as any).nameFontSize || undefined,
            bioFontSize: (profileData as any).bio_font_size || (profileData as any).bioFontSize || undefined,
            socialLinks: profileData.social_links || {},
            footerText,
            favicon,
            googleAnalyticsId,
            privacyPolicyUrl,
            cookiePolicyUrl,
          });

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
          // Apply favicon (emoji or URL)
          if (favicon && typeof favicon === 'string') {
            let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            if (favicon.match(/^https?:\/\//)) {
              // External URL
              link.type = 'image/x-icon';
              link.href = favicon;
            } else {
              // Treat as emoji — render to SVG so it shows in the tab
              const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${favicon}</text></svg>`;
              link.type = 'image/svg+xml';
              link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
            }
          }
        }

        setLinks(normalizeLinkDtos(pageData.links));
        document.body.classList.remove('orbitpage-booting');
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
        footerText={profile.footerText}
        privacyPolicyUrl={privacyPolicyUrl}
        cookiePolicyUrl={cookiePolicyUrl}
        ccpaPolicyUrl={ccpaPolicyUrl}
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
