import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  FileCheck2,
  Globe2,
  HardDrive,
  LockKeyhole,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi, type SetupDependency, type SetupStatus } from "@/lib/api-client";
import { generateSecurePassword, isPasswordStrong, setupInitialCredentials } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { useAppI18n } from "@/lib/i18n";
import { resetAdminOnboardingProgress } from "@/lib/admin-onboarding-storage";
import { OrbitPageBrand } from "./OrbitPageBrand";

interface InitialSetupProps {
  onSetupComplete: () => void | Promise<void>;
}

const dependencyIcons: Record<string, typeof ServerCog> = {
  runtime: ServerCog,
  database: Database,
  storage: HardDrive,
  frontend: FileCheck2,
  sessions: ShieldCheck,
};

function normalizeSlugInput(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 48);
}

export const InitialSetup = ({ onSetupComplete }: InitialSetupProps) => {
  const { tr } = useAppI18n();
  const [step, setStep] = useState(0);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [checksLoading, setChecksLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const requirements = useMemo(() => [
    { label: tr("At least 8 characters", "Almeno 8 caratteri"), test: (value: string) => value.length >= 8 },
    { label: tr("Uppercase and lowercase letters", "Lettere maiuscole e minuscole"), test: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value) },
    { label: tr("At least one number", "Almeno un numero"), test: (value: string) => /\d/.test(value) },
    { label: tr("At least one special character", "Almeno un carattere speciale"), test: (value: string) => /[!@#$%^&*(),.?":{}|<>]/.test(value) },
  ], [tr]);

  const passwordReady = requirements.every((requirement) => requirement.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const slugReady = /^[a-z0-9](?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(slug) && slug.length >= 3 && slug.length <= 48;
  const publicPagePreview = typeof window === "undefined"
    ? `/${slug || "your-page"}`
    : `${window.location.origin}${withBasePath(`/${slug || "your-page"}`)}`;

  const refreshChecks = async () => {
    setChecksLoading(true);
    setError("");
    try {
      const status = await authApi.checkSetupStatus();
      setSetupStatus(status);
      if (!status.isFirstTimeSetup) await onSetupComplete();
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : tr("Installation checks could not be completed.", "Impossibile completare i controlli di installazione."));
    } finally {
      setChecksLoading(false);
    }
  };

  useEffect(() => {
    void refreshChecks();
  // Only run once for the initial installation check.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGeneratePassword = async () => {
    const generated = await generateSecurePassword();
    setPassword(generated);
    setConfirmPassword(generated);
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step !== 2 || !slugReady || !passwordReady || !passwordsMatch) return;
    setIsLoading(true);
    setError("");
    try {
      if (!(await isPasswordStrong(password))) {
        throw new Error(tr("Please meet all password requirements before continuing.", "Soddisfa tutti i requisiti della password prima di continuare."));
      }
      await setupInitialCredentials(password, slug);
      resetAdminOnboardingProgress();
      await onSetupComplete();
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : tr("Setup failed. Please try again.", "Configurazione non riuscita. Riprova."));
    } finally {
      setIsLoading(false);
    }
  };

  const renderDependency = (dependency: SetupDependency) => {
    const Icon = dependencyIcons[dependency.id] || ServerCog;
    return (
      <li className={`setup-dependency${dependency.ok ? " ready" : " failed"}`} key={dependency.id}>
        <span className="setup-dependency-icon"><Icon aria-hidden="true" size={18} /></span>
        <span><strong>{dependency.label}</strong><small>{dependency.detail}</small></span>
        {dependency.ok ? <CheckCircle2 aria-label="OK" size={20} /> : <XCircle aria-label="Error" size={20} />}
      </li>
    );
  };

  return (
    <main className="initial-setup-shell">
      <section className="initial-setup-frame" aria-labelledby="setup-title">
        <header className="initial-setup-header">
          <div className="initial-setup-brand">
            <OrbitPageBrand showName={false} size="md" />
            <div><strong>OrbitPage</strong><span>{tr("Self-hosted setup", "Configurazione self-hosted")}</span></div>
          </div>
          <span className="initial-setup-version">v{__APP_VERSION__}</span>
        </header>

        <ol className="initial-setup-progress" aria-label={tr("Setup progress", "Avanzamento configurazione")}>
          {[tr("System", "Sistema"), tr("Administrator", "Amministratore"), tr("Public URL", "URL pubblico")].map((label, index) => (
            <li className={index === step ? "active" : index < step ? "complete" : ""} key={label}>
              <span>{index < step ? <Check aria-hidden="true" size={14} /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <form onSubmit={handleComplete}>
          {step === 0 && (
            <div className="initial-setup-content">
              <p className="initial-setup-kicker">01 / {tr("System check", "Controllo sistema")}</p>
              <h1 id="setup-title">{tr("Make sure the installation is ready.", "Verifichiamo che l'installazione sia pronta.")}</h1>
              <p className="initial-setup-lead">{tr("OrbitPage checks its runtime, database, persistent storage, frontend build and session security before creating the administrator.", "OrbitPage controlla runtime, database, storage persistente, build frontend e sicurezza delle sessioni prima di creare l'amministratore.")}</p>

              {checksLoading ? (
                <div className="setup-check-loading" role="status"><RefreshCw className="setup-spinner" aria-hidden="true" size={20} />{tr("Checking this installation", "Controllo dell'installazione")}</div>
              ) : (
                <ul className="setup-dependency-list">{setupStatus?.dependencies.map(renderDependency)}</ul>
              )}

              {!checksLoading && !setupStatus?.ready && (
                <div className="initial-setup-alert" role="alert">
                  <XCircle aria-hidden="true" size={19} />
                  <span>{tr("Resolve the failed checks, then run the check again. No account has been created yet.", "Risolvi i controlli non riusciti, poi ripeti la verifica. Nessun account è stato ancora creato.")}</span>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="initial-setup-content">
              <p className="initial-setup-kicker">02 / {tr("Administrator", "Amministratore")}</p>
              <h1 id="setup-title">{tr("Protect the private workspace.", "Proteggi il workspace privato.")}</h1>
              <p className="initial-setup-lead">{tr("The first account always has full administrator permissions. Its username is intentionally fixed.", "Il primo account ha sempre tutti i permessi amministrativi. Il nome utente è volutamente fisso.")}</p>

              <div className="setup-form-grid">
                <div className="setup-field setup-field-full">
                  <Label>{tr("Username", "Nome utente")}</Label>
                  <div className="setup-locked-field"><LockKeyhole aria-hidden="true" size={17} /><strong>admin</strong><span>{tr("Fixed", "Fisso")}</span></div>
                </div>
                <div className="setup-field">
                  <div className="setup-field-heading">
                    <Label htmlFor="setup-password">Password</Label>
                    <button onClick={handleGeneratePassword} type="button"><Sparkles aria-hidden="true" size={14} />{tr("Generate", "Genera")}</button>
                  </div>
                  <div className="setup-password-field">
                    <Input id="setup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                    <button aria-label={showPassword ? tr("Hide password", "Nascondi password") : tr("Show password", "Mostra password")} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                </div>
                <div className="setup-field">
                  <Label htmlFor="setup-confirm-password">{tr("Confirm password", "Conferma password")}</Label>
                  <div className="setup-password-field">
                    <Input id="setup-confirm-password" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                    <button aria-label={showConfirmPassword ? tr("Hide password", "Nascondi password") : tr("Show password", "Mostra password")} onClick={() => setShowConfirmPassword((value) => !value)} type="button">{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                </div>
              </div>

              <ul className="setup-password-requirements">
                {requirements.map((requirement) => {
                  const ready = requirement.test(password);
                  return <li className={ready ? "ready" : ""} key={requirement.label}>{ready ? <Check size={14} /> : <X size={14} />}{requirement.label}</li>;
                })}
                <li className={passwordsMatch ? "ready" : ""}>{passwordsMatch ? <Check size={14} /> : <X size={14} />}{tr("Passwords match", "Le password coincidono")}</li>
              </ul>
            </div>
          )}

          {step === 2 && (
            <div className="initial-setup-content">
              <p className="initial-setup-kicker">03 / {tr("Public URL", "URL pubblico")}</p>
              <h1 id="setup-title">{tr("Choose the page address.", "Scegli l'indirizzo della pagina.")}</h1>
              <p className="initial-setup-lead">{tr("This slug becomes the stable public path for the primary page. You can still create additional pages later.", "Questo slug diventa il percorso pubblico stabile della pagina principale. Potrai comunque creare altre pagine in seguito.")}</p>

              <div className="setup-field setup-slug-field">
                <Label htmlFor="setup-slug">{tr("Page slug", "Slug pagina")}</Label>
                <div className="setup-slug-input"><Globe2 aria-hidden="true" size={18} /><Input id="setup-slug" maxLength={48} placeholder="your-page" value={slug} onChange={(event) => setSlug(normalizeSlugInput(event.target.value))} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></div>
                <small>{tr("Lowercase letters, numbers and hyphens. Between 3 and 48 characters.", "Lettere minuscole, numeri e trattini. Da 3 a 48 caratteri.")}</small>
              </div>

              <div className="setup-url-preview">
                <span>{tr("Public page", "Pagina pubblica")}</span>
                <strong>{publicPagePreview}</strong>
              </div>
              <div className="initial-setup-summary">
                <CheckCircle2 aria-hidden="true" size={22} />
                <div><strong>{tr("Ready to create OrbitPage", "Pronto per creare OrbitPage")}</strong><span>{tr("The administrator, page address and starter tutorial will be enabled together.", "Amministratore, indirizzo pagina e tutorial iniziale verranno abilitati insieme.")}</span></div>
              </div>
            </div>
          )}

          {error && <div className="initial-setup-alert" role="alert"><XCircle aria-hidden="true" size={19} /><span>{error}</span></div>}

          <footer className="initial-setup-footer">
            {step === 0 ? (
              <Button onClick={() => void refreshChecks()} type="button" variant="outline" disabled={checksLoading}><RefreshCw className={checksLoading ? "setup-spinner" : ""} size={16} />{tr("Run again", "Ripeti controllo")}</Button>
            ) : (
              <Button onClick={() => { setError(""); setStep((value) => Math.max(0, value - 1)); }} type="button" variant="outline"><ArrowLeft size={16} />{tr("Back", "Indietro")}</Button>
            )}

            {step < 2 ? (
              <Button className="setup-primary-button" disabled={step === 0 ? !setupStatus?.ready : !passwordReady || !passwordsMatch} onClick={() => { setError(""); setStep((value) => value + 1); }} type="button">{tr("Continue", "Continua")}<ArrowRight size={16} /></Button>
            ) : (
              <Button className="setup-primary-button" disabled={!slugReady || isLoading} type="submit">{isLoading ? <RefreshCw className="setup-spinner" size={16} /> : <ShieldCheck size={16} />}{isLoading ? tr("Creating workspace", "Creazione workspace") : tr("Complete setup", "Completa configurazione")}</Button>
            )}
          </footer>
        </form>
      </section>
    </main>
  );
};
