import type { ElementType } from "react";
import {
  ArrowUpRight,
  Check,
  CloudCog,
  Code2,
  Gauge,
  HardDriveDownload,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
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
      title: tr("Content system", "Sistema contenuti"),
      description: tr("Pages, subpages, blocks, menu and scheduling without SaaS plan gates.", "Pagine, sottopagine, blocchi, menu e programmazione senza limiti legati ai piani SaaS."),
    },
    {
      icon: Sparkles,
      title: "OrbitPage AI",
      description: tr("AI-assisted editing is available after you connect a supported provider.", "L'editing assistito dall'AI è disponibile dopo aver collegato un provider supportato."),
    },
    {
      icon: Gauge,
      title: tr("Design and insights", "Design e insight"),
      description: tr("Themes, advanced appearance controls, click analytics and GA4 integration.", "Temi, controlli visivi avanzati, analytics dei clic e integrazione GA4."),
    },
    {
      icon: ShieldCheck,
      title: tr("Privacy and discovery", "Privacy e indicizzazione"),
      description: tr("Consent tools, legal pages, sitemap, robots.txt, llms.txt and public TXT files.", "Consenso, pagine legali, sitemap, robots.txt, llms.txt e file TXT pubblici."),
    },
    {
      icon: UsersRound,
      title: tr("Local team", "Team locale"),
      description: tr("Self-hosted administrators, roles, passwords and two-factor authentication.", "Amministratori self-hosted, ruoli, password e autenticazione a due fattori."),
    },
    {
      icon: HardDriveDownload,
      title: tr("Portable by design", "Portabile per natura"),
      description: tr("Granular backups, restores and media cleanup keep your installation under your control.", "Backup granulari, ripristino e pulizia dei media mantengono l'installazione sotto il tuo controllo."),
    },
  ];

  return (
    <div className="oss-plan-layout" data-testid="open-source-plan">
      <section className="oss-plan-panel" aria-labelledby="oss-plan-title">
        <div className="oss-plan-hero">
          <div>
            <p className="oss-plan-eyebrow">OrbitPage Open Source</p>
            <h2 id="oss-plan-title">{tr("Everything included in the OSS edition is unlocked.", "Tutto ciò che è incluso nell'edizione OSS è sbloccato.")}</h2>
            <p>{tr(
              "This installation has no subscription and no SaaS feature gates. Its real capacity depends only on the infrastructure you operate.",
              "Questa installazione non richiede un abbonamento e non applica limiti dei piani SaaS. La capacità effettiva dipende solo dall'infrastruttura che gestisci.",
            )}</p>
          </div>
          <div className="oss-plan-status" role="status">
            <span><Check aria-hidden="true" size={15} /> {tr("Active edition", "Edizione attiva")}</span>
            <strong>Open Source</strong>
            <small>{tr("No subscription required", "Nessun abbonamento richiesto")}</small>
          </div>
        </div>

        <div className="oss-plan-feature-list" aria-label={tr("Included open-source capabilities", "Funzioni open source incluse")}>
          {features.map(({ icon: Icon, title, description }) => (
            <article className="oss-plan-feature" key={title}>
              <Icon aria-hidden="true" size={19} />
              <div>
                <div className="oss-plan-feature-title">
                  <h3>{title}</h3>
                  <span>{tr("Included", "Incluso")}</span>
                </div>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="oss-plan-operations">
          <ServerCog aria-hidden="true" size={20} />
          <div>
            <strong>{tr("You operate this edition", "Questa edizione è gestita da te")}</strong>
            <p>{tr(
              "Hosting, updates, backups, TLS, email delivery and provider keys remain your responsibility. Managed-only services are not part of the OSS runtime.",
              "Hosting, aggiornamenti, backup, TLS, invio email e chiavi dei provider restano sotto la tua responsabilità. I servizi esclusivamente gestiti non fanno parte del runtime OSS.",
            )}</p>
          </div>
        </div>
      </section>

      <aside className="oss-saas-promo" aria-labelledby="oss-saas-title">
        <div className="oss-saas-promo-heading">
          <span>{tr("Managed alternative", "Alternativa gestita")}</span>
          <CloudCog aria-hidden="true" size={24} />
        </div>
        <h2 id="oss-saas-title">{tr("Let OrbitPage run the infrastructure.", "Lascia che OrbitPage gestisca l'infrastruttura.")}</h2>
        <p>{tr(
          "OrbitPage SaaS keeps the same product workflow while adding the managed services that do not belong in the public runtime.",
          "OrbitPage SaaS mantiene lo stesso flusso di prodotto e aggiunge i servizi gestiti che non appartengono al runtime pubblico.",
        )}</p>
        <ul>
          <li><Check aria-hidden="true" size={15} /> {tr("Managed hosting, CDN, storage and automatic updates", "Hosting, CDN, storage e aggiornamenti automatici gestiti")}</li>
          <li><Check aria-hidden="true" size={15} /> {tr("Custom domains and managed publishing", "Domini personalizzati e pubblicazione gestita")}</li>
          <li><WalletCards aria-hidden="true" size={15} /> {tr("Shop with Stripe, Newsletter and hosted workspaces", "Shop con Stripe, Newsletter e workspace ospitati")}</li>
        </ul>
        <div className="oss-saas-actions">
          <a className="oss-saas-primary" href={`${saasBase}/pricing`} target="_blank" rel="noopener noreferrer">
            {tr("Explore OrbitPage SaaS", "Scopri OrbitPage SaaS")}
            <ArrowUpRight aria-hidden="true" size={16} />
          </a>
          <a className="oss-saas-secondary" href={`${saasBase}/product`} target="_blank" rel="noopener noreferrer">
            {tr("Compare the product", "Confronta il prodotto")}
          </a>
        </div>
        <small>{tr("Opens orbitpage.com in a new tab", "Apre orbitpage.com in una nuova scheda")}</small>
      </aside>
    </div>
  );
}
