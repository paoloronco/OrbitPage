import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";
import { useAppI18n } from "@/lib/i18n";
import { isPasswordStrong } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { authApi } from "@/lib/api-client";
import { apiPath, withBasePath } from "@/lib/base-path";

const useCurrentUsername = () => {
  const [username, setUsername] = useState('admin');
  useEffect(() => {
    authApi.verify().then((r) => {
      if (r.valid && r.user?.username) setUsername(r.user.username);
    }).catch(() => {});
  }, []);
  return username;
};

type MessageType = 'success' | 'error' | 'info' | 'warning';

interface Message {
  type: MessageType;
  text: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  token?: string;
}

export const PasswordManager = () => {
  const { tr } = useAppI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const username = useCurrentUsername();

  // Token-based password reset state
  const [showTokenReset, setShowTokenReset] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [tokenResetMessage, setTokenResetMessage] = useState<Message | null>(null);
  const [tokenResetLoading, setTokenResetLoading] = useState(false);
  const demoMode = DEMO_MODE;
  const passwordControlsDisabled = isLoading || demoMode;
  const tokenResetControlsDisabled = tokenResetLoading || demoMode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (demoMode) {
      setMessage({ type: 'warning', text: 'Password change is disabled in demo mode.' });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    
    if (!(await isPasswordStrong(newPassword))) {
      setMessage({ 
        type: 'error', 
        text: 'Password must be at least 8 characters with minimum 1 uppercase, 1 lowercase, 1 number, and 1 special character' 
      });
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const result = await authApi.changePassword(currentPassword, newPassword);
      
      if (result.success) {
        const successMessage = result.message || 'Password changed successfully! You will be redirected to login...';
        setMessage({ 
          type: 'success', 
          text: successMessage
        });
        
        // Token handling is centralized in authApi; no direct localStorage writes here
        
        // Redirect to admin panel after a short delay
        setTimeout(() => {
          // No need to logout since the password change was successful
          // and we already have a valid token
          window.location.href = withBasePath('/dashboard/account');
        }, 2000);
      } else {
        const errorMessage = result.error || 'Failed to change password. Please try again.';
        setMessage({ 
          type: 'error', 
          text: errorMessage
        });
      }
    } catch (error: unknown) {
      console.error('Error changing password:', error instanceof Error ? error.message : String(error));
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while changing the password. Please try again.';
      setMessage({ 
        type: 'error', 
        text: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (demoMode) {
      setTokenResetMessage({ type: 'warning', text: 'Password reset is disabled in demo mode.' });
      return;
    }

    setTokenResetLoading(true);
    setTokenResetMessage(null);
    try {
      const response = await fetch(apiPath('/auth/reset-via-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: resetNewPassword }),
      });
      const result: ApiResponse = await response.json();
      if (result.success) {
        setTokenResetMessage({ type: 'success', text: result.message || 'Password reset successfully.' });
        setResetToken('');
        setResetNewPassword('');
      } else {
        setTokenResetMessage({ type: 'error', text: result.error || 'Reset failed.' });
      }
    } catch (err: unknown) {
      setTokenResetMessage({ type: 'error', text: err instanceof Error ? err.message : 'An error occurred.' });
    } finally {
      setTokenResetLoading(false);
    }
  };

  return (
    <div className="oss-account-password-group">
      {/* Password Change Form */}
      <Card className={`glass-card p-6 space-y-6 account-panel account-password-panel oss-account-password-card ${demoMode ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="account-section-heading">
          <div>
            <h2>{tr('Change password', 'Cambia password')}</h2>
            <p className="muted">{tr('Update your account password', 'Aggiorna la password del tuo account')}</p>
          {demoMode && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              <p className="font-semibold">Demo mode is active</p>
              <p className="mt-1">Password change is disabled in demo mode.</p>
            </div>
          )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="password-form">
            <input className="sr-only" type="text" name="username" autoComplete="username" value={username} readOnly tabIndex={-1} aria-hidden="true" />
            <div className="field">
              <Label htmlFor="current-password">{tr('Current password', 'Password attuale')}</Label>
              <div className="password-field-control">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input"
                  placeholder={tr('Enter current password', 'Inserisci la password attuale')}
                  autoComplete="current-password"
                  required
                  disabled={passwordControlsDisabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="password-visibility-button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  disabled={passwordControlsDisabled}
                  aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="field">
              <Label htmlFor="new-password">{tr('New password', 'Nuova password')}</Label>
              <div className="password-field-control">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  placeholder={tr('Enter new password', 'Inserisci la nuova password')}
                  autoComplete="new-password"
                  required
                  disabled={passwordControlsDisabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="password-visibility-button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={passwordControlsDisabled}
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <div className="password-requirements">
                <p>{tr('Requirements:', 'Requisiti:')}</p>
                <ul>
                  <li data-valid={newPassword.length >= 8}>{tr('At least 8 characters', 'Almeno 8 caratteri')}</li>
                  <li data-valid={/[A-Z]/.test(newPassword)}>{tr('Uppercase letter', 'Lettera maiuscola')}</li>
                  <li data-valid={/[a-z]/.test(newPassword)}>{tr('Lowercase letter', 'Lettera minuscola')}</li>
                  <li data-valid={/\d/.test(newPassword)}>{tr('Number', 'Numero')}</li>
                  <li data-valid={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)}>{tr('Special character', 'Carattere speciale')}</li>
                </ul>
              </div>
            </div>

            <div className="field">
              <Label htmlFor="confirm-password">{tr('Confirm new password', 'Conferma nuova password')}</Label>
              <div className="password-field-control">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder={tr('Confirm new password', 'Conferma nuova password')}
                  autoComplete="new-password"
                  required
                  disabled={passwordControlsDisabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="password-visibility-button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={passwordControlsDisabled}
                  aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {message && (
              <div className={`text-sm p-3 rounded-lg flex items-center gap-2 ${
                message.type === 'success' 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {message.text}
              </div>
            )}

            <Button
              type="submit"
              variant="gradient"
              className="account-password-action"
              disabled={passwordControlsDisabled}
            >
              {isLoading ? tr('Saving...', 'Salvataggio...') : tr('Change password', 'Cambia password')}
            </Button>
          </form>

      </Card>
      {/* Forgot password — token-based reset */}
      <Card className={`glass-card p-6 space-y-4 account-panel oss-account-recovery-card ${demoMode ? 'opacity-50 pointer-events-none' : ''}`}>
        <button
          type="button"
          className="w-full text-left flex items-center justify-between"
          onClick={() => setShowTokenReset(v => !v)}
          disabled={demoMode}
        >
          <span className="text-sm font-medium text-muted-foreground">Forgot your password?</span>
          <span className="text-xs text-primary">{showTokenReset ? 'Hide' : 'Show'}</span>
        </button>
        {showTokenReset && (
          <form onSubmit={handleTokenReset} className="space-y-4 pt-2 border-t border-primary/10">
            <input className="sr-only" type="text" name="username" autoComplete="username" value={username} readOnly tabIndex={-1} aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              If you have set a <code className="bg-primary/10 px-1 rounded">RESET_TOKEN</code> environment variable on the server, enter it below along with your new password.
            </p>
            {demoMode && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-900">
                <p>Password reset is disabled in demo mode.</p>
              </div>
            )}
            <div className="field">
              <Label htmlFor="reset-token">Reset Token</Label>
              <Input
                id="reset-token"
                type="password"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Enter RESET_TOKEN value"
                autoComplete="off"
                className="glass-card border-primary/20"
                required
                disabled={tokenResetControlsDisabled}
              />
            </div>
            <div className="field">
              <Label htmlFor="reset-new-password">New Password</Label>
              <Input
                id="reset-new-password"
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder={tr('Enter new password', 'Inserisci la nuova password')}
                autoComplete="new-password"
                className="glass-card border-primary/20"
                required
                disabled={tokenResetControlsDisabled}
              />
            </div>
            {tokenResetMessage && (
              <div className={`text-sm p-3 rounded-lg flex items-center gap-2 ${
                tokenResetMessage.type === 'success'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                {tokenResetMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {tokenResetMessage.text}
              </div>
            )}
            <Button type="submit" variant="gradient" className="w-full" disabled={tokenResetControlsDisabled}>
              {tokenResetLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};
