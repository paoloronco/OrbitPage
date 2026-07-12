import { useEffect, useState } from "react";
import { CalendarDays, Code2, Mail, MapPinned, Music2, PlaySquare, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { consentManager } from "@/lib/consent-manager";
import { apiPath } from "@/lib/base-path";
import {
  getEmbedData,
  getKnownEmbedUrl,
  getEmbedProviderLabel,
  resolveEmbedProvider,
  type EmbedProvider,
} from "@/lib/link-blocks";
import {
  getPublicAccentStyle,
  getPublicBlockPadding,
  getPublicBlockStyle,
  getPublicButtonStyle,
  getPublicIconContent,
  getPublicTextColor,
} from "@/lib/public-block-style";
import type { LinkData } from "./LinkCard";

interface PublicEmbedCardProps {
  link: LinkData;
}

const getProviderIcon = (provider: Exclude<EmbedProvider, 'auto'>) => {
  if (provider === 'youtube') return <PlaySquare className="h-5 w-5" />;
  if (provider === 'spotify') return <Music2 className="h-5 w-5" />;
  if (provider === 'calendly') return <CalendarDays className="h-5 w-5" />;
  if (provider === 'google_maps') return <MapPinned className="h-5 w-5" />;
  if (provider === 'newsletter') return <Mail className="h-5 w-5" />;
  return <Code2 className="h-5 w-5" />;
};

export const PublicEmbedCard = ({ link }: PublicEmbedCardProps) => {
  const embed = getEmbedData(link.content);
  const provider = resolveEmbedProvider(embed.provider, embed.snippet);
  const category = embed.consentCategory || 'marketing';
  const [isGranted, setIsGranted] = useState(() => consentManager.isGranted(category));

  useEffect(() => {
    const syncConsent = () => setIsGranted(consentManager.isGranted(category));
    syncConsent();
    return consentManager.onConsentChange(syncConsent);
  }, [category]);

  const textColor = getPublicTextColor(link);
  const secondaryStyle = textColor ? { color: textColor, opacity: 0.72 } : undefined;
  const providerLabel = getEmbedProviderLabel(provider);
  const knownProviderUrl = getKnownEmbedUrl(provider, embed.snippet);

  if (!embed.snippet) {
    return (
      <Card className="glass-card p-0" style={getPublicBlockStyle(link)}>
        <div className={getPublicBlockPadding(link.size)}>
          <div className="rounded-xl border border-dashed border-current/25 px-4 py-7 text-center text-sm font-medium opacity-70">
            Paste an embed snippet from Edit to configure this block.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-card overflow-hidden p-0" style={getPublicBlockStyle(link)}>
      <div className={`flex items-start gap-3 ${getPublicBlockPadding(link.size)}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/15" style={getPublicAccentStyle(link)}>
          {getPublicIconContent(link, getProviderIcon(provider))}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold leading-tight">{link.title || providerLabel}</p>
            <span className="rounded-full border border-current/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] opacity-65">{providerLabel}</span>
          </div>
          {link.description ? <p className="mt-1 text-sm leading-relaxed" style={secondaryStyle}>{link.description}</p> : null}
        </div>
      </div>

      {isGranted ? (
        <div className="relative w-full overflow-hidden border-t border-current/10 bg-slate-950/10" style={{ height: `${embed.height || 360}px` }}>
          <iframe
            src={knownProviderUrl || apiPath(`/embed/${encodeURIComponent(link.id)}`)}
            title={`${providerLabel}: ${link.title || 'embedded content'}`}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox={knownProviderUrl
              ? "allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              : "allow-scripts allow-forms allow-popups allow-presentation"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <div className={`border-t border-current/10 ${getPublicBlockPadding(link.size)}`}>
          <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-current/15 bg-current/[0.04] px-5 py-8 text-center">
            <ShieldCheck className="h-8 w-8 opacity-70" />
            <p className="mt-3 text-sm font-semibold">Third-party content blocked</p>
            <p className="mt-1 max-w-sm text-xs leading-5" style={secondaryStyle}>
              {providerLabel} will load only after {category} consent. No request has been sent to the provider yet.
            </p>
            <button
              type="button"
              onClick={() => {
                consentManager.showBanner();
                consentManager.openPreferences();
              }}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition-smooth hover:bg-primary/90"
              style={getPublicButtonStyle(link)}
            >
              Manage cookie preferences
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};
