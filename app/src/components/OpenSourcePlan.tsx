import type { ElementType } from "react";
import {
  ArrowUpRight,
  Check,
  CloudCog,
  Code2,
  Gauge,
  ServerCog,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useAppI18n, type AppLocale } from "@/lib/i18n";

const SAAS_LOCALE_SLUGS: Record<AppLocale, string> = {
  en: "en-US",
  it: "it-IT",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-PT",
  nl: "nl-NL",
  pl: "pl-PL",
  tr: "tr-TR",
  ru: "ru-RU",
  ar: "ar-SA",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
};

type PlanFeature = {
  icon: ElementType;
  title: string;
  description: string;
};

export function OpenSourcePlan() {
  const { locale, tr } = useAppI18n();
  const saasBase = `https://orbitpage.com/${SAAS_LOCALE_SLUGS[locale]}`;
  const features: PlanFeature[] = [
    {
      icon: Code2,
      title: tr("Pages and design", "Pagine e design"),
      description: tr("Pages, blocks, themes, menu and scheduling.", "Pagine, blocchi, temi, menu e programmazione."),
    },
    {
      icon: Sparkles,
      title: "OrbitPage AI",
      description: tr("Available with the API provider you configure.", "Disponibile con il provider API che configuri."),
    },
    {
      icon: Gauge,
      title: tr("Analytics and discovery", "Analytics e indicizzazione"),
      description: tr("Click analytics, GA4, sitemap and public discovery files.", "Analytics dei clic, GA4, sitemap e file pubblici di indicizzazione."),
    },
    {
      icon: UsersRound,
      title: tr("Team and security", "Team e sicurezza"),
      description: tr("Local accounts, roles, 2FA and portable backups.", "Account locali, ruoli, 2FA e backup portabili."),
    },
  ];

  return (
    <div className="oss-plan-layout" data-testid="open-source-plan">
      <section className="oss-plan-panel" aria-labelledby="oss-plan-title">
        <div className="oss-plan-hero">
          <div>
            <p className="oss-plan-eyebrow">{tr("Current edition", "Edizione attuale")}</p>
            <h2 id="oss-plan-title">OrbitPage Open Source</h2>
            <p>{tr("Self-hosted with no subscription or feature tiers.", "Self-hosted, senza abbonamento né livelli di piano.")}</p>
          </div>
          <div className="oss-plan-status" role="status">
            <Check aria-hidden="true" size={15} />
            <span>{tr("Active", "Attiva")}</span>
          </div>
        </div>

        <div className="oss-plan-section-heading">
          <h3>{tr("Included in this installation", "Incluso in questa installazione")}</h3>
          <p>{tr("No upgrades are required to use these features.", "Non servono upgrade per usare queste funzioni.")}</p>
        </div>
        <div className="oss-plan-feature-list" aria-label={tr("Included open-source capabilities", "Funzioni open source incluse")}>
          {features.map(({ icon: Icon, title, description }) => (
            <article className="oss-plan-feature" key={title}>
              <Icon aria-hidden="true" size={19} />
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="oss-plan-operations">
          <ServerCog aria-hidden="true" size={20} />
          <div>
            <strong>{tr("You manage the server", "Gestisci tu il server")}</strong>
            <p>{tr("Keep hosting, TLS, updates, backups, email and provider keys configured.", "Mantieni configurati hosting, TLS, aggiornamenti, backup, email e chiavi dei provider.")}</p>
          </div>
        </div>
      </section>

      <aside className="oss-saas-promo" aria-labelledby="oss-saas-title">
        <div className="oss-saas-promo-heading">
          <span>OrbitPage SaaS</span>
          <CloudCog aria-hidden="true" size={24} />
        </div>
        <h2 id="oss-saas-title">{tr("Prefer a managed setup?", "Preferisci una gestione completa?")}</h2>
        <p>{tr("OrbitPage handles deployment and platform operations for you.", "OrbitPage gestisce distribuzione e operazioni della piattaforma.")}</p>
        <ul>
          <li><Check aria-hidden="true" size={15} /> {tr("Hosting and automatic updates", "Hosting e aggiornamenti automatici")}</li>
          <li><Check aria-hidden="true" size={15} /> {tr("Managed domains and storage", "Domini e storage gestiti")}</li>
          <li><Check aria-hidden="true" size={15} /> {tr("Hosted Shop and workspaces", "Shop e workspace ospitati")}</li>
        </ul>
        <div className="oss-saas-actions">
          <a className="oss-saas-primary" href={`${saasBase}/pricing`} target="_blank" rel="noopener noreferrer">
            {tr("View SaaS plans", "Vedi i piani SaaS")}
            <ArrowUpRight aria-hidden="true" size={16} />
          </a>
          <a className="oss-saas-secondary" href={`${saasBase}/product`} target="_blank" rel="noopener noreferrer">
            {tr("See the hosted product", "Scopri il prodotto hosted")}
          </a>
        </div>
      </aside>
    </div>
  );
}
