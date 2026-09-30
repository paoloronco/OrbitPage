import { useEffect, useMemo, useState } from 'react';
import { Braces, Check, Clock3, Copy, ExternalLink, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { personalApiTokensApi, type PersonalApiToken } from '@/lib/api-client';
import { getActiveBasePath } from '@/lib/base-path';

const tokenState = (token: PersonalApiToken) => token.status === 'revoked'
  ? 'revoked'
  : token.expiresAt && Date.parse(token.expiresAt) <= Date.now() ? 'expired' : 'active';

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

export function PersonalApiTokens() {
  const [tokens, setTokens] = useState<PersonalApiToken[]>([]);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [access, setAccess] = useState<'full' | 'read' | 'links'>('full');
  const [expiresInDays, setExpiresInDays] = useState<'30' | '90' | '365' | 'never'>('90');
  const [password, setPassword] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(() => tokens.filter((token) => tokenState(token) === 'active').length, [tokens]);
  const apiOrigin = typeof window === 'undefined' ? '' : `${window.location.origin}${getActiveBasePath()}`;
  const curlExample = `export ORBITPAGE_TOKEN='YOUR_TOKEN'\n\ncurl ${apiOrigin}/api/links/export \\\n  --header "Authorization: Bearer $ORBITPAGE_TOKEN"`;

  useEffect(() => {
    void personalApiTokensApi.list()
      .then((result) => { setTokens(result.tokens); setAvailableScopes(result.availableScopes); })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Personal API tokens are unavailable.'))
      .finally(() => setBusy(null));
  }, []);

  const copy = async (value: string, confirmation: string) => {
    await navigator.clipboard.writeText(value);
    setMessage(confirmation);
  };

  const createToken = async () => {
    setBusy('create'); setError(null); setMessage(null); setCreatedToken(null);
    try {
      const scopes = access === 'full'
        ? availableScopes
        : access === 'read'
          ? availableScopes.filter((scope) => scope.endsWith(':read'))
          : availableScopes.filter((scope) => scope.startsWith('links:'));
      if (!scopes.length) throw new Error('No API permission is available for this access level.');
      const result = await personalApiTokensApi.create({
        name,
        scopes,
        expiresInDays: expiresInDays === 'never' ? null : Number(expiresInDays) as 30 | 90 | 365,
        currentPassword: password,
      });
      setTokens((current) => [result.record, ...current]);
      setCreatedToken(result.token); setName(''); setPassword('');
      setMessage('Token created. Copy it now: OrbitPage will not show it again.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The token could not be created.');
    } finally { setBusy(null); }
  };

  const revokeToken = async (token: PersonalApiToken) => {
    if (!window.confirm(`Revoke ${token.name}? Scripts using this token will stop immediately.`)) return;
    setBusy(`revoke:${token.tokenId}`); setError(null); setMessage(null);
    try {
      const result = await personalApiTokensApi.revoke(token.tokenId);
      setTokens((current) => current.map((item) => item.tokenId === token.tokenId ? result.token : item));
      setMessage('Token revoked.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The token could not be revoked.');
    } finally { setBusy(null); }
  };

  return (
    <>
      <section className="team-panel account-api-token-panel">
        <div className="account-section-heading">
          <div>
            <p className="dashboard-kicker">Developer access</p>
            <h2>Personal API tokens</h2>
            <p className="muted">Create revocable credentials for the Automation REST API. They are separate from your dashboard session, OrbitPage AI and OpenAI provider keys, and stay bound to this workspace.</p>
          </div>
          <Braces aria-hidden="true" size={22} />
        </div>

        <div className="api-token-example">
          <div><strong>Quick start</strong><span>Verify the token by fetching links and the current revision. The REST guide and OpenAPI document cover every dashboard resource and the If-Match rules for draft writes.</span></div>
          <pre>{curlExample}</pre>
          <div className="api-token-example-actions">
            <button className="team-button secondary compact" onClick={() => void copy(curlExample, 'Example copied.')} type="button"><Copy size={15} /> Copy example</button>
            <a className="team-button secondary compact" href="https://github.com/paoloronco/OrbitPage/blob/main/docs/API.md" rel="noreferrer" target="_blank"><ExternalLink size={15} /> Open REST API guide</a>
          </div>
        </div>

        <div className="api-token-create-grid">
          <label className="team-field"><span>Token name</span><input maxLength={64} onChange={(event) => setName(event.target.value)} placeholder="GitHub Actions · production" value={name} /></label>
          <label className="team-field"><span>Access</span><select onChange={(event) => setAccess(event.target.value as typeof access)} value={access}><option value="full">Full workspace API access</option><option value="read">Read-only workspace access</option><option value="links">Links only</option></select></label>
          <label className="team-field"><span>Expiry</span><select onChange={(event) => setExpiresInDays(event.target.value as typeof expiresInDays)} value={expiresInDays}><option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option><option value="never">No expiry</option></select></label>
          <label className="team-field"><span>Current password</span><input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>
          <div className="api-token-create-actions"><button className="team-button primary" disabled={busy !== null || !name.trim() || !password} onClick={() => void createToken()} type="button">{busy === 'create' ? <Loader2 className="spin" size={17} /> : <Plus size={17} />} Create token</button><span className="api-token-active-count">{activeCount}/10 active</span></div>
        </div>

        {createdToken && <div className="api-token-reveal" role="status"><div><Check size={18} /><strong>Copy this token now</strong><span>You will not be able to see it again after leaving this page.</span></div><code>{createdToken}</code><button className="team-button secondary compact" onClick={() => void copy(createdToken, 'Token copied.')} type="button"><Copy size={16} /> Copy</button></div>}

        <div className="api-token-list" aria-busy={busy === 'loading'}>
          {busy === 'loading' ? <div className="api-token-empty"><Loader2 className="spin" size={18} /> Loading tokens...</div> : tokens.length === 0 ? <div className="api-token-empty"><KeyRound size={19} /><span><strong>No personal tokens yet</strong><small>Create one when an external automation needs controlled access to this workspace.</small></span></div> : tokens.map((token) => {
            const state = tokenState(token);
            return <article className={`api-token-row ${state}`} key={token.tokenId}><div className="api-token-row-icon"><KeyRound size={17} /></div><div className="api-token-row-main"><div><strong>{token.name}</strong><span className={`api-token-status ${state}`}>{state}</span></div><code>{token.tokenPrefix}••••••••</code><small>Access: {token.scopes.join(' · ')} · /{token.username}</small></div><div className="api-token-row-meta"><span><Clock3 size={13} /> Last used: {formatDate(token.lastUsedAt)}</span><span>Expires: {token.expiresAt ? formatDate(token.expiresAt) : 'Never'}</span></div>{state === 'active' ? <button className="team-button secondary compact danger" disabled={busy !== null} onClick={() => void revokeToken(token)} type="button">{busy === `revoke:${token.tokenId}` ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />} Revoke</button> : <span />}</article>;
          })}
        </div>
        {message && <p className="team-feedback success" role="status">{message}</p>}
        {error && <p className="team-feedback error" role="alert">{error}</p>}
      </section>
    </>
  );
}
