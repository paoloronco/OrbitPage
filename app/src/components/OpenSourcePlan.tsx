import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useAppI18n } from "@/lib/i18n";
import { adminSubsectionPath } from "@/lib/admin-navigation";
import { publicLocaleSlug } from "@/lib/public-routing";
import { withBasePath } from "@/lib/base-path";

const repositoryUrl = "https://github.com/paoloronco/OrbitPage";

export function OpenSourcePlan() {
  const { locale, tr } = useAppI18n();
  const included = [
    { title: tr("Pages and design", "Pagine e design"), detail: tr("Profiles, content blocks, menus, extra pages and themes.", "Profili, blocchi, menu, pagine aggiuntive e temi.") },
    { title: tr("Publishing and analytics", "Pubblicazione e analytics"), detail: tr("Your domain, QR codes, sitemap, visits and clicks.", "Il tuo dominio, codici QR, sitemap, visite e clic.") },
    { title: tr("Newsletter and AI", "Newsletter e AI"), detail: tr("Use your SMTP server for email and your own API key for the AI assistant.", "Usa il tuo server SMTP per le email e una tua chiave API per l'assistente AI.") },
    { title: tr("Team and recovery", "Team e ripristino"), detail: tr("Local users, roles, two-factor authentication, backup and restore.", "Utenti locali, ruoli, autenticazione a due fattori, backup e ripristino.") },
  ];
  const responsibilities = [
    { title: tr("Server and domain", "Server e dominio"), detail: tr("Run the app on your server and configure HTTPS.", "Esegui l'app sul tuo server e configura HTTPS.") },
    { title: tr("Updates and backups", "Aggiornamenti e backup"), detail: tr("Install new versions and keep copies of your persistent data.", "Installa le nuove versioni e conserva copie dei dati persistenti.") },
    { title: tr("Optional services", "Servizi facoltativi"), detail: tr("Add SMTP and an AI provider only if you use those tools.", "Configura SMTP e un provider AI solo se usi quelle funzioni.") },
  ];

  return (
    <div className="oss-plan-layout" data-testid="open-source-plan">
      <section className="oss-plan-intro" aria-labelledby="oss-plan-title">
        <div className="oss-plan-intro-copy">
          <p className="oss-plan-kicker">{tr("Current edition", "Edizione attuale")}</p>
          <h2 id="oss-plan-title">OrbitPage Open Source</h2>
          <p>{tr("No subscription or paid feature tiers. The app and its data stay on your server.", "Nessun abbonamento né funzioni a pagamento. L'app e i suoi dati restano sul tuo server.")}</p>
        </div>
        <dl className="oss-plan-summary">
          <div><dt>{tr("Software", "Software")}</dt><dd>{tr("Free · MIT license", "Gratuito · licenza MIT")}</dd></div>
          <div><dt>{tr("Hosting", "Hosting")}</dt><dd>{tr("Managed by you", "Gestito da te")}</dd></div>
        </dl>
      </section>

      <div className="oss-plan-columns">
        <section className="oss-plan-panel oss-plan-included" aria-labelledby="oss-plan-included-title">
          <div className="oss-plan-section-heading">
            <h3 id="oss-plan-included-title">{tr("Included here", "Già incluso")}</h3>
          </div>
          <ul className="oss-plan-feature-list">
            {included.map(({ title, detail }) => <li className="oss-plan-feature" key={title}><strong>{title}</strong><span>{detail}</span></li>)}
          </ul>
          <a className="oss-plan-text-link oss-plan-source-link" href={repositoryUrl} target="_blank" rel="noopener noreferrer">{tr("Source code", "Codice sorgente")}<ArrowUpRight aria-hidden="true" size={15} /></a>
        </section>

        <section className="oss-plan-panel oss-plan-management" aria-labelledby="oss-plan-management-title">
          <div className="oss-plan-section-heading">
            <h3 id="oss-plan-management-title">{tr("What you manage", "Cosa gestisci tu")}</h3>
          </div>
          <dl className="oss-plan-responsibilities">
            {responsibilities.map(({ title, detail }) => <div key={title}><dt>{title}</dt><dd>{detail}</dd></div>)}
          </dl>
          <div className="oss-plan-links">
            <a className="oss-plan-primary-link" href={withBasePath(adminSubsectionPath("account", "general", locale))}>{tr("Open account settings", "Apri le impostazioni account")}<ArrowRight aria-hidden="true" size={16} /></a>
            <a className="oss-plan-text-link" href={`${repositoryUrl}/blob/main/docs/wiki/Deployment.md`} target="_blank" rel="noopener noreferrer">{tr("Deployment guide", "Guida all'installazione")}<ArrowUpRight aria-hidden="true" size={15} /></a>
          </div>
        </section>
      </div>

      <footer className="oss-plan-footer">
        <p>{tr("Want hosting and updates handled for you?", "Preferisci che hosting e aggiornamenti siano gestiti per te?")}</p>
        <a className="oss-plan-text-link" href={`https://orbitpage.com/${publicLocaleSlug(locale)}/pricing`} target="_blank" rel="noopener noreferrer">{tr("See OrbitPage SaaS", "Scopri OrbitPage SaaS")}<ArrowUpRight aria-hidden="true" size={15} /></a>
      </footer>
    </div>
  );
}
