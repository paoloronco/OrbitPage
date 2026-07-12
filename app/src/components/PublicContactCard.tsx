import type { CSSProperties } from "react";
import type { LinkData } from "./LinkCard";
import { getContactData } from "@/lib/link-blocks";
import { Card } from "@/components/ui/card";
import { Globe, Mail, MapPin, MessageCircle, Phone, Send, UserRound } from "lucide-react";
import { getPublicAccentStyle, getPublicBlockPadding, getPublicBlockStyle, getPublicButtonStyle, getPublicIconContent, getPublicIconSize, getPublicTextColor } from "@/lib/public-block-style";

interface PublicContactCardProps {
  link: LinkData;
}

const buildLink = (href?: string, text?: string, style?: CSSProperties) => {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium break-all hover:text-primary hover:underline"
      style={style}
    >
      {text || href}
    </a>
  );
};

export const PublicContactCard = ({ link }: PublicContactCardProps) => {
  const contact = getContactData(link.content);
  const items: Array<{ key: string; value?: string; href?: string; Icon: typeof Phone }> = [
    { key: "Phone", value: contact.phone, href: contact.phone ? `tel:${contact.phone}` : undefined, Icon: Phone },
    { key: "Email", value: contact.email, href: contact.email ? `mailto:${contact.email}` : undefined, Icon: Mail },
    { key: "Website", value: contact.website, href: contact.website, Icon: Globe },
    { key: "Address", value: contact.address, Icon: MapPin },
    { key: "WhatsApp", value: contact.whatsapp, href: contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}` : undefined, Icon: MessageCircle },
    { key: "Telegram", value: contact.telegram, href: contact.telegram ? (contact.telegram.includes("http") ? contact.telegram : `https://t.me/${contact.telegram.replace(/^@/, '')}`) : undefined, Icon: Send },
  ];
  const primaryAction = items.find((item) => item.href && (item.key === "Phone" || item.key === "Email" || item.key === "WhatsApp"));
  const cardStyle = getPublicBlockStyle(link);
  const textColor = getPublicTextColor(link);
  const textStyle = textColor ? { color: textColor } : undefined;
  const secondaryTextStyle = textColor ? { color: textColor, opacity: 0.74 } : undefined;
  const panelStyle = textColor
    ? {
        borderColor: "color-mix(in srgb, currentColor 20%, transparent)",
        backgroundColor: "color-mix(in srgb, currentColor 8%, transparent)",
        color: textColor,
      }
    : undefined;

  return (
    <Card className="glass-card overflow-hidden p-0" style={cardStyle}>
      <div className={`space-y-4 ${getPublicBlockPadding(link.size)}`}>
        <div className="flex items-start gap-3">
          <div className={`flex ${getPublicIconSize(link.size)} shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/15`} style={getPublicAccentStyle(link)}>
            {getPublicIconContent(link, <UserRound className="h-5 w-5" />)}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-base font-semibold leading-tight"
              style={{
                ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
                ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
                ...textStyle,
              }}
            >
              {contact.name || link.title || "Contact"}
            </div>
            {contact.role || contact.title ? (
              <div
                className="mt-1 text-sm text-muted-foreground"
                style={{
                  ...secondaryTextStyle,
                  ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}),
                  ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}),
                }}
              >
                {[contact.role, contact.title].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>
        </div>
        {contact.note ? (
          <div className="rounded-md bg-muted/35 px-3 py-2 text-sm leading-relaxed text-muted-foreground" style={panelStyle || secondaryTextStyle}>
            {contact.note}
          </div>
        ) : null}

        <div className="grid gap-2">
          {items.map((item) => item.value ? (
            <div key={item.key} className="flex items-start gap-3 rounded-md border border-border/55 bg-background/35 px-3 py-2 text-sm" style={panelStyle}>
              <item.Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" style={getPublicAccentStyle(link)} />
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground" style={secondaryTextStyle}>{item.key}</span>
                {item.href ? buildLink(item.href, item.value, textStyle) : <span className="break-words" style={textStyle}>{item.value}</span>}
              </div>
            </div>
          ) : null)}
        </div>
        {primaryAction ? (
          <a
            href={primaryAction.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-smooth hover:bg-primary/90"
            style={getPublicButtonStyle(link)}
          >
            <primaryAction.Icon className="h-4 w-4" />
            {primaryAction.key === "Email" ? "Send email" : primaryAction.key === "WhatsApp" ? "Open WhatsApp" : "Call now"}
          </a>
        ) : null}
      </div>
    </Card>
  );
};
