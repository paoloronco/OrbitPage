import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Shield, Check, X, Sparkles } from "lucide-react";
import { setupInitialCredentials, setAuthenticated, isPasswordStrong, generateSecurePassword } from "@/lib/auth";
import { useAppI18n } from "@/lib/i18n";
import { OrbitPageBrand } from "./OrbitPageBrand";

interface InitialSetupProps {
  onSetupComplete: () => void;
}

export const InitialSetup = ({ onSetupComplete }: InitialSetupProps) => {
  const { tr } = useAppI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const requirements = [
    { label: tr("At least 8 characters", "Almeno 8 caratteri"), test: (value: string) => value.length >= 8 },
    { label: tr("Uppercase letter (A-Z)", "Una lettera maiuscola (A-Z)"), test: (value: string) => /[A-Z]/.test(value) },
    { label: tr("Lowercase letter (a-z)", "Una lettera minuscola (a-z)"), test: (value: string) => /[a-z]/.test(value) },
    { label: tr("Number (0-9)", "Un numero (0-9)"), test: (value: string) => /\d/.test(value) },
    { label: tr("Special character", "Un carattere speciale"), test: (value: string) => /[!@#$%^&*(),.?":{}|<>]/.test(value) },
  ];

  const metCount = requirements.filter((requirement) => requirement.test(password)).length;
  const allMet = metCount === requirements.length;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!(await isPasswordStrong(password))) {
      setError(tr("Please meet all password requirements before continuing.", "Soddisfa tutti i requisiti della password prima di continuare."));
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(tr("Passwords do not match.", "Le password non coincidono."));
      setIsLoading(false);
      return;
    }

    try {
      const success = await setupInitialCredentials(password);
      if (success) {
        setAuthenticated("admin");
        onSetupComplete();
      } else {
        setError(tr("Setup failed. Please try again.", "Configurazione non riuscita. Riprova."));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Setup failed. Please try again.", "Configurazione non riuscita. Riprova."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePassword = async () => {
    const generated = await generateSecurePassword();
    setPassword(generated);
    setConfirmPassword(generated);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: "linear-gradient(135deg, hsl(240 15% 6%) 0%, hsl(260 25% 11%) 100%)" }}>
      <div className="w-full max-w-[420px]">

        {/* Logo + heading */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <OrbitPageBrand showName={false} size="lg" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">{tr("Welcome to OrbitPage", "Benvenuto in OrbitPage")}</h1>
            <p className="text-sm mt-1" style={{ color: "hsl(240 10% 62%)" }}>
              {tr("Create an admin password to get started", "Crea una password amministratore per iniziare")}
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "hsl(240 15% 11% / 0.95)",
            border: "1px solid hsl(240 15% 22%)",
            boxShadow: "0 24px 64px hsl(0 0% 0% / 0.5)",
          }}
        >
          {/* Info banner */}
          <div
            className="flex items-start gap-3 rounded-xl p-3.5"
            style={{ background: "hsl(260 75% 65% / 0.10)", border: "1px solid hsl(260 75% 65% / 0.20)" }}
          >
            <div className="w-4 h-4 mt-0.5 shrink-0 rounded-full flex items-center justify-center"
                 style={{ background: "hsl(260 75% 65% / 0.20)" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(260 75% 70%)" }} />
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "hsl(240 15% 78%)" }}>
              {tr("Credentials are stored locally with", "Le credenziali sono conservate localmente con")} {" "}
              <span className="font-semibold text-white">bcrypt hashing</span>. {" "}
              {tr("Change the password anytime from the Security tab.", "Puoi cambiare la password in qualsiasi momento dalla sezione Sicurezza.")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username (fixed) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(240 10% 55%)" }}>
                {tr("Username", "Nome utente")}
              </Label>
              <div
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm"
                style={{ background: "hsl(240 15% 16%)", border: "1px solid hsl(240 15% 24%)" }}
              >
                <span className="font-medium text-white">admin</span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "hsl(260 75% 65% / 0.18)", color: "hsl(260 75% 75%)" }}
                >
                  {tr("Fixed", "Fisso")}
                </span>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider"
                       style={{ color: "hsl(240 10% 55%)" }}>
                  {tr("Password", "Password")}
                </Label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: "hsl(260 75% 72%)", background: "hsl(260 75% 65% / 0.12)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "hsl(260 75% 65% / 0.22)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "hsl(260 75% 65% / 0.12)")}
                >
                  <Sparkles className="w-3 h-3" />
                  {tr("Generate", "Genera")}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tr("Choose a secure password", "Scegli una password sicura")}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pe-10 text-sm h-11"
                  style={{
                    background: "hsl(240 15% 16%)",
                    border: "1px solid hsl(240 15% 26%)",
                    color: "hsl(240 15% 96%)",
                  }}
                />
                <button
                  type="button"
                  className="absolute end-3 top-1/2 -translate-y-1/2"
                  style={{ color: "hsl(240 10% 52%)" }}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Requirements */}
              {password.length > 0 && (
                <div
                  className="rounded-xl p-3.5 space-y-2 mt-1"
                  style={{ background: "hsl(240 15% 8%)", border: "1px solid hsl(240 15% 20%)" }}
                >
                  {requirements.map((req) => {
                    const ok = req.test(password);
                    return (
                      <div key={req.label} className="flex items-center gap-2.5">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all"
                          style={{
                            background: ok ? "hsl(142 76% 36% / 0.25)" : "hsl(240 15% 18%)",
                          }}
                        >
                          {ok
                            ? <Check className="w-2.5 h-2.5" style={{ color: "hsl(142 72% 50%)" }} />
                            : <X className="w-2.5 h-2.5" style={{ color: "hsl(240 10% 42%)" }} />
                          }
                        </div>
                        <span
                          className="text-xs transition-colors"
                          style={{ color: ok ? "hsl(142 65% 58%)" : "hsl(240 10% 52%)" }}
                        >
                          {req.label}
                        </span>
                      </div>
                    );
                  })}
                  {allMet && (
                    <div
                      className="flex items-center gap-2.5 pt-2 mt-1"
                      style={{ borderTop: "1px solid hsl(142 76% 36% / 0.20)" }}
                    >
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                           style={{ background: "hsl(142 76% 36% / 0.25)" }}>
                        <Check className="w-2.5 h-2.5" style={{ color: "hsl(142 72% 50%)" }} />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: "hsl(142 65% 60%)" }}>
                        {tr("Strong password", "Password sicura")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wider"
                     style={{ color: "hsl(240 10% 55%)" }}>
                {tr("Confirm password", "Conferma password")}
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={tr("Confirm your password", "Conferma la password")}
                  required
                  autoComplete="new-password"
                  className="pe-10 text-sm h-11 transition-all"
                  style={{
                    background: "hsl(240 15% 16%)",
                    border: confirmPassword.length === 0
                      ? "1px solid hsl(240 15% 26%)"
                      : passwordsMatch
                        ? "1px solid hsl(142 72% 45% / 0.6)"
                        : "1px solid hsl(0 72% 55% / 0.6)",
                    color: "hsl(240 15% 96%)",
                  }}
                />
                <button
                  type="button"
                  className="absolute end-3 top-1/2 -translate-y-1/2"
                  style={{ color: "hsl(240 10% 52%)" }}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs"
                   style={{ color: passwordsMatch ? "hsl(142 65% 55%)" : "hsl(0 70% 62%)" }}>
                  {passwordsMatch
                    ? <><Check className="w-3 h-3" /> {tr("Passwords match", "Le password coincidono")}</>
                    : <><X className="w-3 h-3" /> {tr("Passwords do not match", "Le password non coincidono")}</>
                  }
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2.5 text-sm rounded-xl px-3.5 py-3"
                style={{ background: "hsl(0 72% 50% / 0.12)", border: "1px solid hsl(0 72% 50% / 0.30)", color: "hsl(0 80% 70%)" }}
              >
                <X className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold rounded-xl mt-1 transition-all"
              disabled={isLoading || !allMet || !passwordsMatch}
              style={{
                background: allMet && passwordsMatch
                  ? "linear-gradient(135deg, hsl(260 75% 60%), hsl(280 80% 68%))"
                  : "hsl(240 15% 22%)",
                color: allMet && passwordsMatch ? "white" : "hsl(240 10% 42%)",
                border: "none",
                boxShadow: allMet && passwordsMatch ? "0 4px 20px hsl(265 75% 60% / 0.35)" : "none",
              }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {tr("Setting up...", "Configurazione...")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {tr("Complete setup", "Completa configurazione")}
                </span>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: "hsl(240 10% 38%)" }}>
          {tr("Powered by", "Realizzato con")} {" "}
          <a
            href="https://github.com/paoloronco/OrbitPage"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors"
            style={{ color: "hsl(260 75% 62%)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "hsl(260 75% 75%)")}
            onMouseLeave={e => (e.currentTarget.style.color = "hsl(260 75% 62%)")}
          >
            OrbitPage
          </a>
          {" - "}{tr("Your self-hosted public page", "La tua pagina pubblica self-hosted")}
        </p>

      </div>
    </div>
  );
};
