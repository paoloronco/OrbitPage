import { useState, useEffect } from "react";
import { PublicView } from "@/components/PublicView";
import { CookieBanner } from "@/components/CookieBanner";
import { LinkData } from "@/components/LinkCard";
import { applyTheme, normalizeTheme } from "@/lib/theme";
import { publicPageApi, consentConfigPublicApi, type ConsentConfigData } from "@/lib/api-client";
import { consentManager } from "@/lib/consent-manager";
import profileAvatar from "@/assets/profile-avatar.jpg";

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

        // In builder mode, inject the external CMP script immediately
        if (cfg.mode === 'builder' && cfg.enabled) {
          consentManager.injectBuilderScript();
        }

        const loadedTheme = normalizeTheme(pageData.theme);
        applyTheme(loadedTheme);

        const profileData = pageData.profile;
        if (profileData) {
          const footerText = (profileData as any).footer_text || (profileData as any).footerText || undefined;
          const favicon = (profileData as any).favicon || undefined;
          const googleAnalyticsId = (profileData as any).google_analytics_id || (profileData as any).googleAnalyticsId || undefined;
          const privacyPolicyUrl = (profileData as any).privacy_policy_url || (profileData as any).privacyPolicyUrl || undefined;
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
          //   1. Set up the gtag stub + GCM v2 defaults (inline, zero network cost)
          //   2. Register the gtag.js load + gtag('config') call as a consent-dependent
          //      action — it only runs once the visitor grants analytics consent.
          if (googleAnalyticsId && typeof googleAnalyticsId === 'string' && googleAnalyticsId.match(/^G-[A-Z0-9]+$/i)) {
            const win = window as any;

            // Ensure gtag stub + GCM v2 defaults exist (server already injects this in
            // production via injectGoogleAnalyticsTag; we set it up here for dev mode).
            if (typeof win.gtag !== 'function') {
              win.dataLayer = win.dataLayer || [];
              win.gtag = function () { win.dataLayer.push(arguments); };
              win.gtag('consent', 'default', {
                analytics_storage:       'denied',
                ad_storage:              'denied',
                ad_user_data:            'denied',
                ad_personalization:      'denied',
                functionality_storage:   'denied',
                personalization_storage: 'denied',
                wait_for_update:         2000,
              });
              win.gtag('js', new Date());
            }

            // Load gtag.js and call config ONLY after analytics consent is granted.
            // No GA network request of any kind is made before this callback fires.
            const gaId = googleAnalyticsId;
            consentManager.registerConsentDependentScript('analytics', () => {
              if (!document.getElementById('lynx-ga-script')) {
                const script = document.createElement('script');
                script.id = 'lynx-ga-script';
                script.async = true;
                script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
                document.head.appendChild(script);
              }
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

        const formattedLinks = (pageData.links || []).map(link => {
          const iconType = link.iconType || (link as any).icon_type;
          return {
            id: String(link.id),
            title: link.title,
            description: link.description || '',
            url: link.url,
            type: (link.type as 'link' | 'text' | 'separator') || 'link',
            icon: link.icon || undefined,
            iconType: iconType || undefined,
            backgroundColor: link.backgroundColor,
            textColor: link.textColor,
            size: link.size,
            content: link.content,
            textItems: link.textItems,
            // Preserve per-link typography and alignment
            titleFontFamily: (link as any).titleFontFamily || (link as any).titleFont || undefined,
            descriptionFontFamily: (link as any).descriptionFontFamily || undefined,
            titleFontSize: (link as any).titleFontSize || undefined,
            descriptionFontSize: (link as any).descriptionFontSize || undefined,
            alignment: (link as any).alignment || undefined
          };
        });

        setLinks(formattedLinks);
        document.body.classList.remove('lynx-booting');
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
            privacyPolicy: profile.privacyPolicyUrl || '',
            cookiePolicy: profile.cookiePolicyUrl || '',
          },
        },
      }
    : consentConfig;

  return (
    <>
      <PublicView
        profile={profile}
        links={links}
        footerText={profile.footerText}
        privacyPolicyUrl={profile.privacyPolicyUrl}
        cookiePolicyUrl={profile.cookiePolicyUrl}
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
