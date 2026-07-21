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

export function TwoFactorManager() {
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

  return <Card className={`glass-card p-6 space-y-5 ${DEMO_MODE ? 'opacity-60 pointer-events-none' : ''}`}>
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Two-step verification</p><h2 className="mt-1 text-xl font-semibold">Authenticator app</h2><p className="mt-1 text-sm text-muted-foreground">Require a rotating code after the password for this administrator.</p></div>
      {status?.enabled ? <ShieldCheck className="h-6 w-6 text-emerald-600" /> : <KeyRound className="h-6 w-6 text-primary" />}
    </div>

    <div className={`flex items-center gap-3 border p-3 ${status?.enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-border bg-muted/40'}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${status?.enabled ? 'bg-emerald-600' : 'bg-slate-400'}`} />
      <div className="grid"><strong className="text-sm">{status?.enabled ? '2FA active' : '2FA off'}</strong><span className="text-xs opacity-75">{status?.enabled ? `${status.recoveryCodesRemaining} recovery codes remaining` : 'Compatible with standard TOTP authenticator apps'}</span></div>
    </div>

    {!setup && <div className="grid gap-3">
      <Label htmlFor="two-factor-password">Current password</Label><Input id="two-factor-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      {status?.enabled && <><Label htmlFor="two-factor-manage-code">Authentication or recovery code</Label><Input id="two-factor-manage-code" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></>}
      {!status?.enabled ? <Button variant="gradient" disabled={busy !== null || !currentPassword || status === null} onClick={startSetup}><QrCode className="h-4 w-4" />{busy === 'setup' ? 'Preparing…' : 'Set up authenticator'}</Button> : <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy !== null || !currentPassword || !code} onClick={regenerate}><RefreshCw className="h-4 w-4" />Replace recovery codes</Button><Button variant="outline" disabled={busy !== null || !currentPassword || !code} onClick={disable}><ShieldOff className="h-4 w-4" />Disable 2FA</Button></div>}
    </div>}

    {setup && <div className="grid gap-5 md:grid-cols-[240px_1fr]">
      <img className="w-full max-w-[240px] border bg-white p-2" alt="QR code for authenticator setup" src={setup.qrDataUrl} />
      <div className="space-y-4"><div><strong>Scan the QR code</strong><p className="text-sm text-muted-foreground">Then enter the current 6-digit code. Setup expires at {new Date(setup.expiresAt).toLocaleTimeString()}.</p></div><details className="text-sm"><summary className="cursor-pointer">Enter key manually</summary><code className="mt-2 block break-all bg-muted p-2">{setup.secretKey}</code></details><Label htmlFor="two-factor-confirm-code">Authentication code</Label><Input id="two-factor-confirm-code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /><div className="flex gap-2"><Button variant="gradient" disabled={busy !== null || code.length !== 6} onClick={confirmSetup}><Check className="h-4 w-4" />Verify and enable</Button><Button variant="outline" disabled={busy !== null} onClick={() => { setSetup(null); setCode(''); }}>Cancel</Button></div></div>
    </div>}

    {recoveryCodes.length > 0 && <div className="space-y-3 border border-amber-300 bg-amber-50 p-4 text-amber-950"><div><strong>Save these one-time recovery codes</strong><p className="text-sm">They are shown only now. Store them in a password manager.</p></div><div className="grid gap-2 sm:grid-cols-2">{recoveryCodes.map((recoveryCode) => <code className="border border-amber-200 bg-white p-2 text-center font-semibold" key={recoveryCode}>{recoveryCode}</code>)}</div><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join('\n'))}><Copy className="h-4 w-4" />Copy codes</Button></div>}
    {message && <p className="text-sm text-emerald-700" role="status">{message}</p>}{error && <p className="text-sm text-destructive" role="alert">{error}</p>}
  </Card>;
}
