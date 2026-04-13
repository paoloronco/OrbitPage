import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Shield, Check, X, Sparkles, Lock } from "lucide-react";
import { setupInitialCredentials, setAuthenticated, isPasswordStrong, generateSecurePassword } from "@/lib/auth";

interface InitialSetupProps {
  onSetupComplete: () => void;
}

interface Requirement {
  label: string;
  test: (p: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { label: "At least 8 characters",  test: (p) => p.length >= 8 },
  { label: "Uppercase letter (A–Z)",  test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter (a–z)",  test: (p) => /[a-z]/.test(p) },
  { label: "Number (0–9)",            test: (p) => /\d/.test(p) },
  { label: "Special character",       test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export const InitialSetup = ({ onSetupComplete }: InitialSetupProps) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const metMet = REQUIREMENTS.filter((r) => r.test(password)).length;
  const allMet = metMet === REQUIREMENTS.length;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!isPasswordStrong(password)) {
      setError("Please meet all password requirements before continuing.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const success = await setupInitialCredentials(password);
      if (success) {
        setAuthenticated("admin");
        onSetupComplete();
      } else {
        setError("Setup failed. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed. Please try again.");
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
    <div className="min-h-screen flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-md space-y-5">

        {/* Header above card */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg"
                   style={{ boxShadow: "0 0 32px hsl(260 75% 65% / 0.4)" }}>
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-primary" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold gradient-text">Welcome to Lynx</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            First time here? Create your admin password<br />to secure your personal links hub.
          </p>
        </div>

        <Card className="glass-card p-6 space-y-5">

          {/* Info row */}
          <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3"
               style={{ background: "hsl(260 75% 65% / 0.08)" }}>
            <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground/80 leading-relaxed">
              Your credentials are stored locally with bcrypt hashing.
              You can change the password anytime from the <span className="text-primary font-medium">Security</span> tab.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username (fixed) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Username</Label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-muted/40 text-sm">
                <span className="text-foreground font-medium">admin</span>
                <span className="ml-auto text-xs font-medium text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                  Fixed
                </span>
              </div>
              <p className="text-xs text-muted-foreground">The admin username cannot be changed.</p>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePassword}
                  className="h-7 text-xs px-2 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Generate
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 bg-muted/40 border-border focus:border-primary/60 text-foreground placeholder:text-muted-foreground"
                  placeholder="Choose a secure password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>

              {/* Requirements */}
              {password.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 mt-2 space-y-1.5">
                  {REQUIREMENTS.map((req) => {
                    const ok = req.test(password);
                    return (
                      <div key={req.label} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          ok ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground/50"
                        }`}>
                          {ok
                            ? <Check className="w-2.5 h-2.5" />
                            : <X className="w-2.5 h-2.5" />
                          }
                        </div>
                        <span className={`text-xs transition-colors ${
                          ok ? "text-emerald-400 font-medium" : "text-muted-foreground"
                        }`}>
                          {req.label}
                        </span>
                      </div>
                    );
                  })}
                  {allMet && (
                    <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                      <span className="text-xs text-emerald-400 font-semibold">Strong password!</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`pr-10 bg-muted/40 border-border focus:border-primary/60 text-foreground placeholder:text-muted-foreground transition-colors ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? "border-emerald-500/50 focus:border-emerald-500/70"
                        : "border-destructive/50 focus:border-destructive/70"
                      : ""
                  }`}
                  placeholder="Confirm your password"
                  required
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {confirmPassword.length > 0 && (
                <p className={`text-xs flex items-center gap-1 ${passwordsMatch ? "text-emerald-400" : "text-destructive"}`}>
                  {passwordsMatch
                    ? <><Check className="w-3 h-3" /> Passwords match</>
                    : <><X className="w-3 h-3" /> Passwords do not match</>
                  }
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                <X className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="gradient"
              className="w-full h-11 text-base font-semibold mt-1"
              disabled={isLoading || !allMet || !passwordsMatch}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Setting up…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Complete Setup
                </span>
              )}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground/60">
          Powered by{" "}
          <a
            href="https://github.com/paoloronco/Lynx"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary transition-colors"
          >
            Lynx
          </a>
          {" "}— Your personal links hub
        </p>
      </div>
    </div>
  );
};
