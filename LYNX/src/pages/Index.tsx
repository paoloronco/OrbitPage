import { useState, useEffect } from "react";
import { PublicView } from "@/components/PublicView";
import { LinkData } from "@/components/LinkCard";
import { applyTheme, normalizeTheme } from "@/lib/theme";
import { publicPageApi } from "@/lib/api-client";
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

  // Load all public page data in one request so the default UI never flashes.
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const pageData = await publicPageApi.get();
        if (cancelled) return;

        const loadedTheme = normalizeTheme(pageData.theme);
        applyTheme(loadedTheme);

        const profileData = pageData.profile;
        if (profileData) {
          const footerText = (profileData as any).footer_text || (profileData as any).footerText || undefined;
          const favicon = (profileData as any).favicon || undefined;
          const googleAnalyticsId = (profileData as any).google_analytics_id || (profileData as any).googleAnalyticsId || undefined;
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
          });

          // Inject Google Analytics 4 script if a Measurement ID is configured
          if (googleAnalyticsId && typeof googleAnalyticsId === 'string' && googleAnalyticsId.match(/^G-[A-Z0-9]+$/i)) {
            const encodedGoogleAnalyticsId = encodeURIComponent(googleAnalyticsId);
            const scripts = Array.from(document.scripts);
            const existingScript = scripts.some((script) =>
              script.id === 'lynx-ga-script' ||
              (script.src.includes('googletagmanager.com/gtag/js') && script.src.includes(`id=${encodedGoogleAnalyticsId}`))
            );
            const existingConfig = scripts.some((script) =>
              script.id === 'lynx-ga-config' ||
              !!script.textContent?.includes(`gtag('config', '${googleAnalyticsId}')`) ||
              !!script.textContent?.includes(`gtag('config', "${googleAnalyticsId}")`)
            );

            if (!existingScript) {
              const script = document.createElement('script');
              script.id = 'lynx-ga-script';
              script.async = true;
              script.src = `https://www.googletagmanager.com/gtag/js?id=${encodedGoogleAnalyticsId}`;
              document.head.appendChild(script);
            }

            if (!existingConfig) {
              const configScript = document.createElement('script');
              configScript.id = 'lynx-ga-config';
              configScript.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${googleAnalyticsId}');`;
              document.head.appendChild(configScript);
            }
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

  return (
    <PublicView
      profile={profile}
      links={links}
      footerText={profile.footerText}
    />
  );
};

export default Index;
