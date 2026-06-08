import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Key, CheckCircle, AlertTriangle, Shield } from "lucide-react";
import { isPasswordStrong } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { authApi } from "@/lib/api-client";
import { apiPath, withBasePath } from "@/lib/base-path";

const useCurrentUsername = () => {
  const [username, setUsername] = useState('admin');
  useEffect(() => {
    authApi.verify().then((r) => { if (r.valid && r.user?.username) setUsername(r.user.username); }).catch(() => {});
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
          window.location.href = withBasePath('/admin');
        }, 2000);
      } else {
        const errorMessage = result.error || 'Failed to change password. Please try again.';
        setMessage({ 
          type: 'error', 
          text: errorMessage
        });
      }
    } catch (error: any) {
      console.error('Error changing password:', error.message);
      const errorMessage = error?.message || 'An error occurred while changing the password. Please try again.';
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
    } catch (err: any) {
      setTokenResetMessage({ type: 'error', text: err?.message || 'An error occurred.' });
    } finally {
      setTokenResetLoading(false);
    }
  };

  const handleResetSuccess = () => {
    setMessage({ 
      type: 'success', 
      text: 'Application reset successful. You will be redirected to setup...' 
    });
    
    // Clear any existing auth data
    authApi.logout();
    
    // Redirect to setup page
    setTimeout(() => {
      window.location.href = withBasePath('/admin');
    }, 2000);
  };

  const handleResetApp = async (): Promise<void> => {
    if (demoMode) {
      setMessage({
        type: 'warning',
        text: 'Application reset is disabled in demo mode.'
      });
      return;
    }

    if (!window.confirm('Are you sure you want to reset the application? This will delete all data and cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await authApi.reset();
      if (result.success) {
        handleResetSuccess();
      } else {
        throw new Error(result.error || 'Reset failed');
      }
    } catch (error: any) {
      console.error('Reset failed:', error.message);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to reset application. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Security Status */}
      <Card className="glass-card p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold gradient-text">Security Status</h2>
          
          <div className="text-sm bg-primary/10 p-2 rounded-lg">
            <p className="font-medium">Current Admin: <span className="text-primary">{username}</span></p>
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Enhanced Security Active</span>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>✅ Passwords hashed with bcrypt (12 rounds)</p>
            <p>✅ Session token encrypted with AES-GCM</p>
            <p>✅ Device-specific encryption keys</p>
            <p>✅ 12-hour session timeout</p>
            <p>✅ Strong password requirements</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Username:</strong> {username}</p>
        </div>
      </Card>

      {/* Password Change Form */}
      <Card className={`glass-card p-6 space-y-6 ${demoMode ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Key className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold gradient-text">Change Password</h2>
          <p className="text-muted-foreground text-sm">
            Update your admin password
          </p>
          {demoMode && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              <p className="font-semibold">Demo mode is active</p>
              <p className="mt-1">Password change is disabled in demo mode.</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="glass-card border-primary/20 pr-10"
                  placeholder="Enter current password"
                  required
                  disabled={passwordControlsDisabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  disabled={passwordControlsDisabled}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="glass-card border-primary/20 pr-10"
                  placeholder="Enter new password"
                  required
                  disabled={passwordControlsDisabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={passwordControlsDisabled}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Requirements:</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li className={newPassword.length >= 8 ? 'text-green-400' : ''}>At least 8 characters</li>
                  <li className={/[A-Z]/.test(newPassword) ? 'text-green-400' : ''}>Uppercase letter</li>
                  <li className={/[a-z]/.test(newPassword) ? 'text-green-400' : ''}>Lowercase letter</li>
                  <li className={/\d/.test(newPassword) ? 'text-green-400' : ''}>Number</li>
                  <li className={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? 'text-green-400' : ''}>Special character</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="glass-card border-primary/20 pr-10"
                  placeholder="Confirm new password"
                  required
                  disabled={passwordControlsDisabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={passwordControlsDisabled}
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
              className="w-full"
              disabled={passwordControlsDisabled}
            >
              {isLoading ? "Changing Password..." : "Change Password"}
            </Button>
          </form>

        <div className="pt-4 border-t border-primary/20">
          <div className={`bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3 ${demoMode ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Reset Authentication</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This will completely reset the instance, clearing all users, links, profile data, and themes. You'll need to set up the admin account again.
            </p>
            {demoMode && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-900">
                <p>Application reset is disabled in demo mode.</p>
              </div>
            )}
            <Button
              onClick={handleResetApp}
              variant="destructive"
              size="sm"
              className="w-full"
              disabled={isLoading || demoMode}
            >
              Clear Auth Data & Reset
            </Button>
          </div>
        </div>
      </Card>
      {/* Forgot password — token-based reset */}
      <Card className={`glass-card p-6 space-y-4 ${demoMode ? 'opacity-50 pointer-events-none' : ''}`}>
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
            <p className="text-xs text-muted-foreground">
              If you have set a <code className="bg-primary/10 px-1 rounded">RESET_TOKEN</code> environment variable on the server, enter it below along with your new password.
            </p>
            {demoMode && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-900">
                <p>Password reset is disabled in demo mode.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reset-token">Reset Token</Label>
              <Input
                id="reset-token"
                type="password"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Enter RESET_TOKEN value"
                className="glass-card border-primary/20"
                required
                disabled={tokenResetControlsDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-new-password">New Password</Label>
              <Input
                id="reset-new-password"
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="Enter new password"
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
