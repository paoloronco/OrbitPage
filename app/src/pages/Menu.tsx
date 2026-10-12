import { useEffect, useState } from 'react';
import { MenuView } from '@/components/MenuView';
import { normalizeMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { publicPageApi, consentConfigPublicApi, type ConsentConfigData } from '@/lib/api-client';
import { withPageRootPath } from '@/lib/base-path';
import { trackPublicPageView, startPublicPageEngagement } from '@/lib/public-runtime';
import { consentManager } from '@/lib/consent-manager';
import { CookieBanner } from '@/components/CookieBanner';

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuCatalog | null>(null);
  const [consentConfig, setConsentConfig] = useState<ConsentConfigData | null>(null);
  useEffect(() => consentConfig ? startPublicPageEngagement() : undefined, [consentConfig]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const value = window.__ORBITPAGE_STATIC_SNAPSHOT__?.menu ?? (await publicPageApi.get()).menu;
        const normalized = normalizeMenuCatalog(value);
        if (active && normalized.enabled) {
          setMenu(normalized);
          const config = window.__ORBITPAGE_STATIC_SNAPSHOT__?.consentConfig ?? (await consentConfigPublicApi.get()).data;
          if (!active) return;
          if (config.mode === 'hardcoded') config.hardcoded.categories.analytics.enabled = true;
          consentManager.init(config);
          if (config.mode === 'builder') consentManager.injectBuilderScript();
          setConsentConfig(config);
          if (consentManager.isGranted('analytics')) trackPublicPageView();
        }
      } catch {
        // The menu can remain readable when consent settings are unavailable; tracking stays off.
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  if (!menu) {
    return (
      <main className="orbitpage-menu orbitpage-menu--missing">
        <section>
          <p>Menu unavailable</p>
          <h1>This venue has not published its menu yet.</h1>
          <a href={withPageRootPath('/')}>Return to the main page</a>
        </section>
      </main>
    );
  }

  const selectedSectionId = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('section') || '';
  return <><MenuView menu={menu} pageHref={withPageRootPath('/')} selectedSectionId={selectedSectionId} />{consentConfig?.mode === 'hardcoded' && consentConfig.enabled && <CookieBanner config={consentConfig} />}</>;
}
