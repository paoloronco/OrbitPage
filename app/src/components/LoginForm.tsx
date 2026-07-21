import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { authenticateUser, setAuthenticated } from "@/lib/auth";
import { authApi } from "@/lib/api-client";
import { OrbitPageBrand } from "./OrbitPageBrand";

interface LoginFormProps {
  onLogin: () => void;
}

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [secondFactorCode, setSecondFactorCode] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = challengeToken
        ? await authApi.verifyTwoFactor(challengeToken, secondFactorCode)
        : await authenticateUser(password, username);

      if ('requiresTwoFactor' in result && result.requiresTwoFactor && result.challengeToken) {
        setChallengeToken(result.challengeToken);
        setPassword("");
        return;
      }

      if (('authenticated' in result && result.authenticated) || ('token' in result && result.token)) {
        setAuthenticated(username);
        onLogin();
      } else {
        setError("Invalid credentials");
      }
    } catch (error) {
      console.error('Login error:', error);
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4">
      <Card className="glass-card p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <OrbitPageBrand showName={false} size="lg" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">{challengeToken ? "Two-step verification" : "Admin Access"}</h1>
          <p className="text-muted-foreground text-sm">
            {challengeToken ? (recoveryMode ? "Use one of the recovery codes saved during setup." : "Enter the 6-digit code from your authenticator app.") : "Enter your credentials to access the admin panel"}
          </p>
        </div>


        <form onSubmit={handleSubmit} className="space-y-4">
          {!challengeToken && <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="glass-card border-primary/20"
              placeholder="Enter username"
              required
              autoComplete="username"
            />
          </div>}

          {!challengeToken && <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-card border-primary/20 pr-10"
                placeholder="Enter password"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>}

          {challengeToken && <div className="space-y-2">
            <Label htmlFor="second-factor-code">{recoveryMode ? "Recovery code" : "Authentication code"}</Label>
            <div className="relative">
              <Input id="second-factor-code" autoComplete="one-time-code" autoCapitalize="characters" inputMode={recoveryMode ? "text" : "numeric"} maxLength={recoveryMode ? 32 : 6} value={secondFactorCode} onChange={(event) => setSecondFactorCode(recoveryMode ? event.target.value.toUpperCase() : event.target.value.replace(/\D/g, ''))} className="glass-card border-primary/20 pl-10" required />
              {recoveryMode ? <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /> : <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
            </div>
          </div>}

          {error && (
            <div className="text-destructive text-sm text-center p-2 bg-destructive/10 rounded">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="gradient"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Authenticating..." : challengeToken ? "Verify and continue" : "Login to Admin"}
          </Button>
        </form>

        {challengeToken && <div className="flex flex-col items-center gap-2">
          <Button type="button" variant="ghost" className="text-sm" onClick={() => { setRecoveryMode((value) => !value); setSecondFactorCode(''); setError(''); }}>{recoveryMode ? "Use authenticator app" : "Use a recovery code"}</Button>
          <Button type="button" variant="ghost" className="text-sm text-muted-foreground" onClick={() => { setChallengeToken(''); setSecondFactorCode(''); setRecoveryMode(false); setError(''); }}>Back to sign in</Button>
        </div>}

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Secure admin access for link management
          </p>
        </div>
      </Card>
    </div>
  );
};
