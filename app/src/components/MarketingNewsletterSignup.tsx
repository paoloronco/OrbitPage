import { useState } from 'react';
import { Mail } from '@/components/ui/material-icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEMO_MODE } from '@/lib/config';
import { useAppI18n } from '@/lib/i18n';

export function MarketingNewsletterSignup() {
  const { tr, locale } = useAppI18n();
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  return <Card className="glass-card p-6 account-panel account-marketing-card">
    <div className="account-section-heading">
      <div><h2>{tr('Marketing emails', 'Email di marketing')}</h2><p className="muted">{tr('Occasional OrbitPage news, tips and product offers. Optional; no hosted account required.', 'Novità, consigli e offerte occasionali di OrbitPage. Facoltativo; non serve un account SaaS.')}</p></div>
      <Mail aria-hidden="true" className="h-6 w-6" />
    </div>
    <form className="account-marketing-form" action="https://orbitpage.com/api/marketing/subscribe" method="post" target="_blank" rel="noopener noreferrer" onSubmit={(event) => { if (DEMO_MODE) event.preventDefault(); else setSubmitted(true); }}>
      <div className="space-y-2"><Label htmlFor="orbitpage-marketing-email">Email</Label><Input id="orbitpage-marketing-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={DEMO_MODE} /></div>
      <input type="hidden" name="source" value="oss" />
      <input type="hidden" name="locale" value={locale} />
      <label className="marketing-preference-check"><input type="checkbox" name="consent" value="true" checked={consent} required disabled={DEMO_MODE} onChange={(event) => { setConsent(event.target.checked);setSubmitted(false); }} /><span>{tr('Send me occasional OrbitPage tips and product offers by email. I can unsubscribe anytime.', 'Desidero ricevere consigli e offerte occasionali di OrbitPage via email. Posso disiscrivermi in qualsiasi momento.')}</span></label>
      <p className="muted">{tr('Only your email, language and consent are sent to OrbitPage when you continue. Confirm using the email link to activate your subscription. Use the unsubscribe link in any newsletter to stop it.', 'Solo email, lingua e consenso vengono inviati a OrbitPage quando continui. Conferma dal link ricevuto via email per attivare l’iscrizione. Per revocarla usa il link in qualsiasi newsletter.')} <a href="https://orbitpage.com/en-US/privacy" target="_blank" rel="noopener noreferrer">{tr('Privacy policy', 'Informativa privacy')}</a></p>
      <div className="account-marketing-footer">
        {submitted && <p className="muted" role="status">{tr('Continue in the OrbitPage tab to check the result. A request alone does not activate your subscription.', 'Continua nella scheda OrbitPage per verificare l’esito. La sola richiesta non attiva l’iscrizione.')}</p>}
        <Button className="account-marketing-action" variant="outline" type="submit" disabled={!consent || DEMO_MODE}>{tr('Confirm by email', 'Conferma via email')}</Button>
      </div>
    </form>
  </Card>;
}
