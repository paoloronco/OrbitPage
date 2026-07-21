import { ArrowUpRight, Github, Settings2 } from "lucide-react";
import { OrbitPageBrand } from "./OrbitPageBrand";
import { withBasePath } from "@/lib/base-path";

export function UnderConstruction() {
  return (
    <main className="orbitpage-construction-shell">
      <section className="orbitpage-construction-panel" aria-labelledby="construction-title">
        <div className="orbitpage-construction-brand">
          <OrbitPageBrand showName={false} size="lg" />
          <div>
            <strong>OrbitPage</strong>
            <span>Self-hosted edition</span>
          </div>
        </div>

        <div className="orbitpage-construction-status">
          <span aria-hidden="true" />
          Installation ready
        </div>

        <h1 id="construction-title">This page is under construction.</h1>
        <p>
          Welcome to OrbitPage. The application is running and waiting for its owner to complete the private workspace setup.
        </p>

        <div className="orbitpage-construction-actions">
          <a className="construction-primary-action" href={withBasePath("/dashboard/profile")}>
            <Settings2 aria-hidden="true" size={18} />
            Set up this page
          </a>
          <a href="https://github.com/paoloronco/OrbitPage" rel="noopener noreferrer" target="_blank">
            <Github aria-hidden="true" size={18} />
            Open-source repository
            <ArrowUpRight aria-hidden="true" size={15} />
          </a>
          <a href="https://orbitpage.com" rel="noopener noreferrer" target="_blank">
            OrbitPage managed hosting
            <ArrowUpRight aria-hidden="true" size={15} />
          </a>
        </div>
      </section>
    </main>
  );
}
