import { useEffect, useState } from 'react';
import { MenuView } from '@/components/MenuView';
import { normalizeMenuCatalog, type MenuCatalog } from '@/lib/menu';
import { publicPageApi } from '@/lib/api-client';
import { withBasePath } from '@/lib/base-path';

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuCatalog | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const value = window.__ORBITPAGE_STATIC_SNAPSHOT__?.menu ?? (await publicPageApi.get()).menu;
        const normalized = normalizeMenuCatalog(value);
        if (active && normalized.enabled) setMenu(normalized);
      } catch {
        if (active) setMenu(null);
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
          <a href={withBasePath('/')}>Return to the main page</a>
        </section>
      </main>
    );
  }

  return <MenuView menu={menu} />;
}
