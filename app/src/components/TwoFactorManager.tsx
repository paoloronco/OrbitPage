import { useAppI18n } from "@/lib/i18n";
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, KeyRound, QrCode, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { twoFactorApi } from '@/lib/api-client';
import { DEMO_MODE } from '@/lib/config';

type Status = { enabled: boolean; recoveryCodesRemaining: number };
type Setup = { qrDataUrl: string; secretKey: string; expiresAt: string };

export function TwoFactorManager({ username = "admin" }: { username?: string }) {
  const { tr } = useAppI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => setStatus(await twoFactorApi.status());
  useEffect(() => { void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : 'Two-factor status is unavailable.')); }, []);

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name); setError(''); setMessage('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'The security change failed.'); } finally { setBusy(null); }
  };

  const startSetup = () => run('setup', async () => {
    const result = await twoFactorApi.setup(currentPassword);
    setSetup({ secretKey: result.secretKey, expiresAt: result.expiresAt, qrDataUrl: await QRCode.toDataURL(result.uri, { width: 240, margin: 1, errorCorrectionLevel: 'M' }) });
    setCurrentPassword('');
  });

  const confirmSetup = () => run('confirm', async () => {
    const result = await twoFactorApi.confirm(code);
    setRecoveryCodes(result.recoveryCodes); setSetup(null); setCode('');
    setMessage('Two-factor authentication is active. Save these recovery codes now.');
    await refresh();
  });

  const regenerate = () => run('recovery', async () => {
    const result = await twoFactorApi.regenerateRecoveryCodes(currentPassword, code);
    setRecoveryCodes(result.recoveryCodes); setCurrentPassword(''); setCode('');
    setMessage('New recovery codes created. Previous codes are no longer valid.');
    await refresh();
  });

  const disable = () => run('disable', async () => {
    if (!window.confirm('Disable two-factor authentication for this user?')) return;
    await twoFactorApi.disable(currentPassword, code);
    setRecoveryCodes([]); setCurrentPassword(''); setCode('');
    setMessage('Two-factor authentication was disabled and older sessions were revoked.');
    await refresh();
  });

  return <Card className={`glass-card p-6 space-y-5 account-panel account-mfa-panel oss-account-mfa-card ${DEMO_MODE ? 'opacity-60 pointer-events-none' : ''}`}>
    <div className="account-section-heading">
      <div><p className="oss-account-kicker">{tr("Two-step verification", "Verifica in due passaggi")}</p><h2>{tr("Authenticator app", "App di autenticazione")}</h2></div>
      {status?.enabled ? <ShieldCheck className="h-6 w-6 text-emerald-600" /> : <KeyRound className="h-6 w-6 text-primary" />}
    </div>

    <div className={`mfa-status ${status?.enabled ? 'enabled' : ''}`}>
      <span className="mfa-status-dot" aria-hidden="true" />
      <div><strong>{status?.enabled ? tr("Two-factor authentication is active", "Autenticazione a due fattori attiva") : tr("Two-factor authentication is off", "Autenticazione a due fattori disattivata")}</strong><span>{status?.enabled ? `${status.recoveryCodesRemaining} recovery codes remaining` : tr("Protect sign-in with a time-based code from your authenticator app.", "Proteggi l’accesso con un codice temporaneo della tua app di autenticazione.")}</span></div>
    </div>

    {!setup && <form className="mfa-identity-check" onSubmit={(event) => { event.preventDefault(); if (!status?.enabled) void startSetup(); }}>
      <input className="sr-only" type="text" name="username" autoComplete="username" value={username} readOnly tabIndex={-1} aria-hidden="true" />
      <p className="muted">{tr("Enter your current password before changing two-factor authentication.", "Inserisci la password attuale prima di modificare l’autenticazione a due fattori.")}</p>
      <div className="field"><Label htmlFor="two-factor-password">{tr("Current password", "Password attuale")}</Label><Input id="two-factor-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
      {status?.enabled && <><Label htmlFor="two-factor-manage-code">Authentication or recovery code</Label><Input id="two-factor-manage-code" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></>}
      {!status?.enabled ? <Button type="submit" variant="gradient" disabled={busy !== null || !currentPassword || status === null}><QrCode className="h-4 w-4" />{busy === 'setup' ? 'Preparing…' : tr("Set up authenticator", "Configura autenticatore")}</Button> : <div className="mfa-actions"><Button type="button" className="account-secondary-action" variant="outline" disabled={busy !== null || !currentPassword || !code} onClick={regenerate}><RefreshCw className="h-4 w-4" />{tr("Replace recovery codes", "Sostituisci codici di recupero")}</Button><Button type="button" className="account-secondary-action" variant="outline" disabled={busy !== null || !currentPassword || !code} onClick={disable}><ShieldOff className="h-4 w-4" />{tr("Disable 2FA", "Disattiva 2FA")}</Button></div>}
    </form>}

    {setup && <div className="mfa-setup-grid">
      <img alt="QR code for the OrbitPage authenticator setup" height="240" src={setup.qrDataUrl} width="240" />
      <div className="mfa-setup-fields">
        <div><strong>{tr('1. Scan the QR code', '1. Scansiona il codice QR')}</strong><p className="muted">{tr('Use Google Authenticator, 1Password, Microsoft Authenticator or another TOTP app.', 'Usa Google Authenticator, 1Password, Microsoft Authenticator o un’altra app TOTP.')}</p><p className="muted">{tr('Setup expires at', 'La configurazione scade alle')} {new Date(setup.expiresAt).toLocaleTimeString()}.</p></div>
        <details><summary>{tr('Enter the key manually', 'Inserisci la chiave manualmente')}</summary><code className="mfa-secret">{setup.secretKey}</code></details>
        <div className="field"><Label htmlFor="two-factor-confirm-code">{tr('2. Enter the 6-digit code', '2. Inserisci il codice a 6 cifre')}</Label><Input id="two-factor-confirm-code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></div>
        <div className="mfa-actions"><Button className="account-primary-action" variant="gradient" disabled={busy !== null || code.length !== 6} onClick={confirmSetup}><Check className="h-4 w-4" />{tr('Verify and enable', 'Verifica e attiva')}</Button><Button className="account-secondary-action" variant="outline" disabled={busy !== null} onClick={() => { setSetup(null); setCode(''); }}>{tr('Cancel', 'Annulla')}</Button></div>
      </div>
    </div>}

    {recoveryCodes.length > 0 && <div className="mfa-recovery-box"><div><strong>{tr('Save these one-time recovery codes', 'Salva questi codici di recupero monouso')}</strong><p>{tr('They are shown only now. Store them in a password manager.', 'Vengono mostrati solo ora. Salvali in un gestore di password.')}</p></div><div className="mfa-code-grid">{recoveryCodes.map((recoveryCode) => <code key={recoveryCode}>{recoveryCode}</code>)}</div><Button className="account-secondary-action" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join('\n'))}><Copy className="h-4 w-4" />{tr('Copy codes', 'Copia codici')}</Button></div>}
    {message && <p className="text-sm text-emerald-700" role="status">{message}</p>}{error && <p className="text-sm text-destructive" role="alert">{error}</p>}
  </Card>;
}
