import { type FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Check, LoaderCircle, Mail, MailX } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { apiPath, withBasePath } from '@/lib/base-path';
import '../components/newsletter-workspace.css';

type Landing = { fromName: string; publicPageUrl: string };
const messages = {
  confirmed: { title: 'Subscription confirmed', copy: 'You are on the list. Future updates will arrive by email.', success: true },
  unsubscribed: { title: 'You have been unsubscribed', copy: 'This address will not receive future campaigns from this newsletter.', success: true },
  invalid: { title: 'This link is no longer valid', copy: 'It may have expired or already been replaced. You can return to the sender’s page and subscribe again.', success: false },
} as const;

export default function Newsletter() {
  const location = useLocation();
  const isStatus = location.pathname.endsWith('/newsletter/status');
  const state = new URLSearchParams(location.search).get('state') as keyof typeof messages;
  const message = messages[state] || messages.invalid;
  const [landing, setLanding] = useState<Landing | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isStatus) return;
    let active = true;
    fetch(apiPath('/newsletter/public/landing'), { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<Landing> : Promise.reject(new Error('Newsletter is unavailable.')))
      .then((result) => { if (active) setLanding(result); })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Newsletter is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isStatus]);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const response = await fetch(apiPath('/newsletter/public/subscribe'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, consent }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Subscription failed.');
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Subscription failed.');
    } finally { setSending(false); }
  }

  if (isStatus) {
    const Icon = message.success ? Check : MailX;
    return <main className="newsletter-public-shell"><section className="newsletter-status-panel"><strong>OrbitPage</strong><span className={message.success ? 'newsletter-status-icon success' : 'newsletter-status-icon'}><Icon aria-hidden="true" size={26} /></span><h1>{message.title}</h1><p>{message.copy}</p><a className="button" href={withBasePath('/')}>Go to OrbitPage</a></section></main>;
  }

  return <main className="newsletter-public-shell"><section className="newsletter-public-panel">
    <header><strong>OrbitPage</strong><span className="newsletter-public-icon"><Mail aria-hidden="true" size={22} /></span></header>
    {loading ? <p role="status">Loading newsletter…</p> : landing ? <>
      <p className="dashboard-kicker">Email updates</p>
      <h1>Stay close to {landing.fromName}</h1>
      <p className="newsletter-public-intro">New releases, menus, events and useful updates, sent directly by {landing.fromName}. No social algorithm in between.</p>
      {sent ? <div className="newsletter-public-success" role="status"><Check aria-hidden="true" size={22} /><div><strong>Check your inbox</strong><span>Use the confirmation link within 48 hours to join {landing.fromName}’s newsletter.</span></div></div> : <form className="newsletter-public-form" onSubmit={subscribe}>
        <label><span>Name <small>optional</small></span><input autoComplete="name" maxLength={100} onChange={(event) => setName(event.target.value)} value={name} /></label>
        <label><span>Email</span><input autoComplete="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        <label className="newsletter-consent"><input checked={consent} onChange={(event) => setConsent(event.target.checked)} required type="checkbox" /><span>I want to receive email updates from {landing.fromName}. I can unsubscribe at any time.</span></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button aria-busy={sending} className="button" disabled={sending} type="submit">{sending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <Mail aria-hidden="true" size={17} />}{sending ? 'Sending confirmation' : 'Subscribe'}</button>
      </form>}
      <a className="newsletter-back-link" href={landing.publicPageUrl}><ArrowLeft aria-hidden="true" size={15} />Back to the public page</a>
    </> : <><h1>Newsletter unavailable</h1><p role="alert">{error}</p><a href={withBasePath('/')}>Back to the public page</a></>}
  </section></main>;
}
