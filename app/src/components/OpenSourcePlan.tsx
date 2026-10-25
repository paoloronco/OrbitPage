import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, FileText, Github, Mail, PackageCheck, Puzzle, RefreshCw, Server, Users, Wrench } from "lucide-react";
import { useAppI18n } from "@/lib/i18n";
import { adminSubsectionPath } from "@/lib/admin-navigation";
import { publicLocaleSlug } from "@/lib/public-routing";
import { withBasePath } from "@/lib/base-path";
import { SelfHostedInstanceDetails } from "./SelfHostedInstanceDetails";

const repositoryUrl = "https://github.com/paoloronco/OrbitPage";

export function OpenSourcePlan({ version, canManageInstance, onInstallUpdate }: {
  version: string; canManageInstance: boolean; onInstallUpdate: (version: string) => void;
}) {
  const { locale, tr } = useAppI18n();
  const included = [
    { icon: FileText, title: tr("Pages and design", "Pagine e design"), detail: tr("Profiles, content blocks, menus, extra pages and themes.", "Profili, blocchi, menu, pagine aggiuntive e temi.") },
    { icon: BarChart3, title: tr("Publishing and analytics", "Pubblicazione e analytics"), detail: tr("Your domain, QR codes, sitemap, visits and clicks.", "Il tuo dominio, codici QR, sitemap, visite e clic.") },
    { icon: Mail, title: tr("Newsletter and AI", "Newsletter e AI"), detail: tr("Use your SMTP server for email and your own API key for the AI assistant.", "Usa il tuo server SMTP per le email e una tua chiave API per l'assistente AI.") },
    { icon: Users, title: tr("Team and recovery", "Team e ripristino"), detail: tr("Local users, roles, two-factor authentication, backup and restore.", "Utenti locali, ruoli, autenticazione a due fattori, backup e ripristino.") },
  ];
  const responsibilities = [
    { icon: Server, title: tr("Server and domain", "Server e dominio"), detail: tr("Run the app on your server and configure HTTPS.", "Esegui l'app sul tuo server e configura HTTPS.") },
    { icon: RefreshCw, title: tr("Updates and backups", "Aggiornamenti e backup"), detail: tr("Install new versions and keep copies of your persistent data.", "Installa le nuove versioni e conserva copie dei dati persistenti.") },
    { icon: Puzzle, title: tr("Optional services", "Servizi facoltativi"), detail: tr("Add SMTP and an AI provider only if you use those tools.", "Configura SMTP e un provider AI solo se usi quelle funzioni.") },
  ];

  return (
    <div className="oss-plan-layout" data-testid="open-source-plan">
      <section className="oss-plan-intro" aria-labelledby="oss-plan-title">
        <h2 id="oss-plan-title">OrbitPage Open Source</h2>
        <div className="oss-plan-resources">
          <a className="oss-plan-resource-link" href={repositoryUrl} target="_blank" rel="noopener noreferrer"><Github aria-hidden="true" size={17} />{tr("Source code", "Codice sorgente")}<ArrowUpRight aria-hidden="true" size={14} /></a>
          <a className="oss-plan-resource-link" href={`${repositoryUrl}/blob/main/docs/wiki/administration/Deployment.md`} target="_blank" rel="noopener noreferrer"><BookOpen aria-hidden="true" size={17} />{tr("Deployment guide", "Guida all'installazione")}<ArrowUpRight aria-hidden="true" size={14} /></a>
        </div>
      </section>

      <div className="oss-plan-columns">
        <div className="oss-account-layout account-workspace oss-plan-instance">
          <SelfHostedInstanceDetails version={version} canManageInstance={canManageInstance} onInstallUpdate={onInstallUpdate} />
        </div>
        <div className="oss-plan-sidebar">
          <section className="oss-plan-panel oss-plan-summary" aria-labelledby="oss-plan-included-title">
            <div className="oss-plan-summary-group">
              <div className="oss-plan-section-heading">
                <span aria-hidden="true"><PackageCheck size={18} /></span>
                <h3 id="oss-plan-included-title">{tr("Included here", "Già incluso")}</h3>
              </div>
              <ul className="oss-plan-feature-list">
                {included.map(({ icon: Icon, title, detail }) => <li className="oss-plan-feature" key={title}><span className="oss-plan-item-icon" aria-hidden="true"><Icon size={18} /></span><span><strong>{title}</strong><small>{detail}</small></span></li>)}
              </ul>
            </div>
            <div className="oss-plan-summary-group" aria-labelledby="oss-plan-management-title">
              <div className="oss-plan-section-heading">
                <span aria-hidden="true"><Wrench size={18} /></span>
                <h3 id="oss-plan-management-title">{tr("What you manage", "Cosa gestisci tu")}</h3>
              </div>
              <ul className="oss-plan-responsibilities">
                {responsibilities.map(({ icon: Icon, title, detail }) => <li key={title}><span className="oss-plan-item-icon" aria-hidden="true"><Icon size={18} /></span><span><strong>{title}</strong><small>{detail}</small></span></li>)}
              </ul>
              <div className="oss-plan-links">
                <a className="oss-plan-primary-link" href={withBasePath(adminSubsectionPath("account", "general", locale))}>{tr("Open account settings", "Apri le impostazioni account")}<ArrowRight aria-hidden="true" size={16} /></a>
              </div>
            </div>
          </section>

          <aside className="oss-plan-managed-promo" aria-labelledby="oss-plan-managed-title">
            <div><span>{tr("Managed", "Gestito")}</span><h3 id="oss-plan-managed-title">OrbitPage SaaS</h3></div>
            <p>{tr("Want hosting and updates handled for you?", "Preferisci che hosting e aggiornamenti siano gestiti per te?")}</p>
            <a className="oss-plan-managed-link" href={`https://orbitpage.com/${publicLocaleSlug(locale)}/pricing`} target="_blank" rel="noopener noreferrer">{tr("See OrbitPage SaaS", "Scopri OrbitPage SaaS")}<ArrowUpRight aria-hidden="true" size={15} /></a>
          </aside>
        </div>
      </div>
    </div>
  );
}
