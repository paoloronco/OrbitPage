import { useEffect, useMemo, useState } from 'react';
import { Braces, Check, Clock3, Copy, ExternalLink, Info, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { personalApiTokensApi, type PersonalApiToken } from '@/lib/api-client';
import { personalApiTokenAccess } from '@/lib/personal-api-token-access';
import { useAppI18n } from '@/lib/i18n';
import { getActiveBasePath } from '@/lib/base-path';

const tokenState = (token: PersonalApiToken) => token.status === 'revoked'
  ? 'revoked'
  : token.expiresAt && Date.parse(token.expiresAt) <= Date.now() ? 'expired' : 'active';

export function PersonalApiTokens() {
  const { tr, locale } = useAppI18n();
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

  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";

  const activeCount = useMemo(() => tokens.filter((token) => tokenState(token) === 'active').length, [tokens]);
  const apiOrigin = typeof window === 'undefined' ? '' : `${window.location.origin}${getActiveBasePath()}`;
  const curlExample = `export ORBITPAGE_TOKEN='YOUR_TOKEN'\n\ncurl ${apiOrigin}/api/links/export \\\n  --header "Authorization: Bearer $ORBITPAGE_TOKEN"`;

  useEffect(() => {
    void personalApiTokensApi.list()
      .then((result) => { setTokens(result.tokens); setAvailableScopes(result.availableScopes); })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : tr("Personal API tokens are unavailable.", "I token API personali non sono disponibili.")))
      .finally(() => setBusy(null));
  }, [tr]);

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
      setMessage(tr("Token created. Copy it now: OrbitPage will not show it again.", "Token creato. Copialo ora: OrbitPage non lo mostrerà di nuovo."));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : tr("The personal API token could not be created.", "Non è stato possibile creare il token API personale."));
    } finally { setBusy(null); }
  };

  const revokeToken = async (token: PersonalApiToken) => {
    if (!window.confirm(tr("Revoke {name}? Scripts using this token will stop immediately.", "Revocare {name}? Gli script che usano questo token si interromperanno immediatamente.").replace('{name}', token.name))) return;
    setBusy(`revoke:${token.tokenId}`); setError(null); setMessage(null);
    try {
      const result = await personalApiTokensApi.revoke(token.tokenId);
      setTokens((current) => current.map((item) => item.tokenId === token.tokenId ? result.token : item));
      setMessage(tr("Token revoked.", "Token revocato."));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : tr("The token could not be revoked.", "Non è stato possibile revocare il token."));
    } finally { setBusy(null); }
  };

  return (
    <>
      <section className="team-panel account-api-token-panel">
        <div className="account-section-heading">
          <div>
            <p className="dashboard-kicker">{tr("Developer access", "Accesso sviluppatori")}</p>
            <h2>{tr("Personal API tokens", "Token API personali")}</h2>
            <p className="muted">{tr("Create revocable credentials for the Automation REST API. They are separate from your dashboard session, OrbitPage AI and OpenAI provider keys, and stay bound to this workspace.", "Crea credenziali revocabili per l'API REST di automazione. Sono separate dalla sessione della dashboard, da OrbitPage AI e dalle chiavi provider OpenAI e restano legate a questo workspace.")}</p>
          </div>
          <Braces aria-hidden="true" size={22} />
        </div>

        <div className="api-token-example">
          <div><strong>{tr("Quick start", "Avvio rapido")}</strong><span>{tr("Verify the token by fetching links and the current revision. The REST guide and OpenAPI document cover every dashboard resource and the If-Match rules for draft writes.", "Verifica il token recuperando i link e la revisione corrente. La guida REST e il documento OpenAPI descrivono tutte le risorse della dashboard e le regole If-Match per le modifiche alla bozza.")}</span></div>
          <pre>{curlExample}</pre>
          <div className="api-token-example-actions">
            <button className="team-button secondary compact" onClick={() => void copy(curlExample, tr("Example copied.", "Esempio copiato."))} type="button"><Copy size={15} /> {tr("Copy example", "Copia esempio")}</button>
            <a className="team-button secondary compact" href="https://github.com/paoloronco/OrbitPage/blob/main/docs/API.md" rel="noreferrer" target="_blank"><ExternalLink size={15} /> {tr("Open REST API guide", "Apri la guida API REST")}</a>
          </div>
        </div>

        <div className="api-token-create-grid">
          <label className="team-field"><span>{tr("Token name", "Nome token")}</span><input maxLength={64} onChange={(event) => setName(event.target.value)} placeholder={tr("GitHub Actions · production", "GitHub Actions · produzione")} value={name} /></label>
          <label className="team-field"><span>{tr("Access", "Accesso")}</span><select onChange={(event) => setAccess(event.target.value as typeof access)} value={access}><option value="full">{tr("Full workspace API access", "Full workspace API access")}</option><option value="read">{tr("Read-only workspace access", "Read-only workspace access")}</option><option value="links">{tr("Links only", "Links only")}</option></select></label>
          <label className="team-field"><span>{tr("Expiry", "Scadenza")}</span><select onChange={(event) => setExpiresInDays(event.target.value as typeof expiresInDays)} value={expiresInDays}><option value="30">30 {tr("days", "giorni")}</option><option value="90">90 {tr("days", "giorni")}</option><option value="365">365 {tr("days", "giorni")}</option><option value="never">{tr("No expiry", "Nessuna scadenza")}</option></select></label>
          <label className="team-field"><span>{tr("Current password", "Password attuale")}</span><input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>
          <div className="api-token-create-actions"><button className="team-button primary" disabled={busy !== null || !name.trim() || !password} onClick={() => void createToken()} type="button">{busy === 'create' ? <Loader2 className="spin" size={17} /> : <Plus size={17} />}{tr("Create token", "Crea token")}</button><span className="team-doc-help api-token-security-help"><button aria-describedby="api-token-security-tooltip" aria-label={tr("Your token is shown only once", "Il token viene mostrato una sola volta")} className="team-doc-help-trigger" type="button"><Info aria-hidden="true" size={15} /></button><span className="team-doc-tooltip" id="api-token-security-tooltip" role="tooltip"><strong>{tr("Your token is shown only once", "Il token viene mostrato una sola volta")}</strong><span>{tr("Copy it immediately and store it securely, like a password. Rotate it when needed and revoke it when you no longer use it.", "Copialo subito e conservalo in modo sicuro, come una password. Sostituiscilo quando necessario e revocalo quando non lo usi più.")}</span></span></span><span className="api-token-active-count">{activeCount}/10 {tr("Active", "Attivo")}</span></div>
        </div>

        {createdToken && <div className="api-token-reveal" role="status"><div><Check size={18} /><strong>{tr("Copy this token now", "Copia subito questo token")}</strong><span>{tr("You will not be able to see it again after leaving this page.", "Non potrai più visualizzarlo dopo aver lasciato questa pagina.")}</span></div><code>{createdToken}</code><button className="team-button secondary compact" onClick={() => void copy(createdToken, tr("Token copied.", "Token copiato."))} type="button"><Copy size={16} /> {tr("Copy", "Copia")}</button></div>}

        <div className="api-token-list" aria-busy={busy === 'loading'}>
          {busy === 'loading' ? <div className="api-token-empty"><Loader2 className="spin" size={18} /> {tr("Loading tokens...", "Caricamento token...")}</div> : tokens.length === 0 ? <div className="api-token-empty"><KeyRound size={19} /><span><strong>{tr("No personal tokens yet", "Nessun token personale")}</strong><small>{tr("Create one when an external automation needs controlled access to this workspace.", "Creane uno quando un'automazione esterna richiede un accesso controllato a questo workspace.")}</small></span></div> : tokens.map((token) => {
            const state = tokenState(token);
            const access = personalApiTokenAccess(token.scopes, availableScopes);
            const accessLabel = access === "full" ? "Full workspace API access" : access === "read" ? "Read-only workspace access" : access === "links" ? "Links only" : "Choose individual scopes";
            return <article className={`api-token-row ${state}`} key={token.tokenId}><div className="api-token-row-icon"><KeyRound size={17} /></div><div className="api-token-row-main"><div><strong>{token.name}</strong><span className={`api-token-status ${state}`}>{state === "active" ? tr("Active", "Attivo") : state === "expired" ? tr("Expired", "Scaduto") : tr("Revoked", "Revocato")}</span></div><code>{token.tokenPrefix}••••••••</code><small>{tr("Access", "Accesso")}: {accessLabel} · /{token.username}</small></div><div className="api-token-row-meta"><span><Clock3 size={13} /> {tr("Last used", "Ultimo utilizzo")}: {formatDate(token.lastUsedAt)}</span><span>{tr("Expires", "Scade")}: {token.expiresAt ? formatDate(token.expiresAt) : tr("Never", "Mai")}</span></div>{state === 'active' ? <button className="team-button secondary compact danger" disabled={busy !== null} onClick={() => void revokeToken(token)} type="button">{busy === `revoke:${token.tokenId}` ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}{tr("Revoke", "Revoca")}</button> : <span />}</article>;
          })}
        </div>
        {message && <p className="team-feedback success" role="status">{message}</p>}
        {error && <p className="team-feedback error" role="alert">{error}</p>}
      </section>
    </>
  );
}
