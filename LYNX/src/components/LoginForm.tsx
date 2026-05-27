import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Shield, AlertTriangle, Info } from "lucide-react";
import { authenticateUser, setAuthenticated } from "@/lib/auth";

interface LoginFormProps {
  onLogin: () => void;
}

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const isValid = await authenticateUser(password, username);

      if (isValid) {
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
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Admin Access</h1>
          <p className="text-muted-foreground text-sm">
            Enter your credentials to access the admin panel
          </p>
        </div>


        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
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
          </div>

          <div className="space-y-2">
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
          </div>

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
            {isLoading ? "Authenticating..." : "Login to Admin"}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Secure admin access for link management
          </p>
        </div>
      </Card>
    </div>
  );
};