import { type FormEvent, useEffect, useState } from "react";
import { Check, LoaderCircle, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { apiPath } from "@/lib/base-path";
import { getEditorIntegration } from "@/lib/editor-integration";
import { useAppI18n } from "@/lib/i18n";
import { NEWSLETTER_TRACKING_CONSENT_TEXT } from "@/lib/newsletter-types";
import { getPublicAccentStyle, getPublicBlockPadding, getPublicBlockStyle, getPublicButtonStyle, getPublicIconContent, getPublicIconSize } from "@/lib/public-block-style";

export function PublicNewsletterCard({ link }: { link: LinkData }) {
  const { tr } = useAppI18n();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [trackingConsent, setTrackingConsent] = useState(false);
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const username = window.__ORBITPAGE_STATIC_SNAPSHOT__?.page.pageSlug || getEditorIntegration()?.publicSlug || "";
    const controller = new AbortController();
    fetch(`${apiPath("/newsletter/public/landing")}?username=${encodeURIComponent(username)}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (result?.privacyPolicyUrl?.startsWith("https://")) setPrivacyPolicyUrl(result.privacyPolicyUrl); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");
    try {
      const username = window.__ORBITPAGE_STATIC_SNAPSHOT__?.page.pageSlug || getEditorIntegration()?.publicSlug || "";
      const response = await fetch(apiPath("/newsletter/public/subscribe"), {
        method: "POST",
        headers: { "content-type": username ? "text/plain;charset=UTF-8" : "application/json" },
        body: JSON.stringify({ ...(username ? { username } : {}), email, consent, trackingConsent }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || tr("Subscription failed.", "Iscrizione non riuscita."));
      setState("sent");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : tr("Subscription failed.", "Iscrizione non riuscita."));
      setState("idle");
    }
  }

  return (
    <Card className="glass-card overflow-hidden p-0" style={getPublicBlockStyle(link)}>
      <div className={`space-y-4 ${getPublicBlockPadding(link.size)}`}>
        <div className="public-block-header">
          <div className={`flex ${getPublicIconSize(link.size)} shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/15`} style={getPublicAccentStyle(link)}>
            {getPublicIconContent(link, <Mail className="h-5 w-5" />)}
          </div>
          <div className="public-block-copy">
            <p className="text-base font-semibold leading-tight" style={{ ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}), ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}) }}>{link.title || tr("Join the newsletter", "Iscriviti alla newsletter")}</p>
            {link.description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground" style={{ ...(link.textColor ? { color: link.textColor, opacity: .82 } : {}), ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}), ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}) }}>{link.description}</p> : null}
          </div>
        </div>
        {state === "sent" ? (
          <div className="flex items-start gap-3 rounded-md border border-emerald-300/70 bg-emerald-50/80 p-3 text-sm text-emerald-800" role="status">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span><strong className="block">{tr("Check your inbox", "Controlla la posta")}</strong>{tr("Use the confirmation link to complete your subscription.", "Usa il link di conferma per completare l'iscrizione.")}</span>
          </div>
        ) : (
          <form className="grid gap-3" onSubmit={subscribe}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Email</span>
                <input autoComplete="email" className="h-11 w-full rounded-md border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" maxLength={254} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required type="email" value={email} />
              </label>
              <button aria-busy={state === "sending"} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60" disabled={state === "sending" || !privacyPolicyUrl} style={getPublicButtonStyle(link)} type="submit">
                {state === "sending" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {state === "sending" ? tr("Sending", "Invio") : tr("Subscribe", "Iscriviti")}
              </button>
            </div>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <input checked={consent} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" onChange={(event) => setConsent(event.target.checked)} required type="checkbox" />
              <span>{tr("I want to receive email updates. I can unsubscribe at any time.", "Voglio ricevere aggiornamenti email. Posso annullare l'iscrizione in qualsiasi momento.")}</span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <input checked={trackingConsent} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" onChange={(event) => setTrackingConsent(event.target.checked)} type="checkbox" />
              <span>{tr(NEWSLETTER_TRACKING_CONSENT_TEXT, "Facoltativo: acconsento alla misurazione delle aperture delle mie email e dei clic sui link per aiutare il mittente a migliorare questa newsletter. Posso revocare il consenso da ogni email senza annullare l’iscrizione.")}</span>
            </label>
            {privacyPolicyUrl ? <a className="text-xs underline" href={privacyPolicyUrl} rel="noreferrer" target="_blank">{tr("Privacy Policy", "Informativa sulla privacy")}</a> : null}
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </form>
        )}
      </div>
    </Card>
  );
}
