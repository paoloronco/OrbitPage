import { LinkData } from "./LinkCard";
import { getContactData } from "@/lib/link-blocks";
import { Card } from "@/components/ui/card";

interface PublicContactCardProps {
  link: LinkData;
}

const buildLink = (href?: string, text?: string) => {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm break-all hover:text-primary hover:underline"
    >
      {text || href}
    </a>
  );
};

export const PublicContactCard = ({ link }: PublicContactCardProps) => {
  const contact = getContactData(link.content);
  const items: Array<{ key: string; value?: string; href?: string }> = [
    { key: "Phone", value: contact.phone, href: contact.phone ? `tel:${contact.phone}` : undefined },
    { key: "Email", value: contact.email, href: contact.email ? `mailto:${contact.email}` : undefined },
    { key: "Website", value: contact.website, href: contact.website },
    { key: "Address", value: contact.address },
    { key: "WhatsApp", value: contact.whatsapp, href: contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\\D/g, '')}` : undefined },
    { key: "Telegram", value: contact.telegram, href: contact.telegram ? (contact.telegram.includes("http") ? contact.telegram : `https://t.me/${contact.telegram.replace(/^@/, '')}`) : undefined },
  ];

  return (
    <Card className="glass-card space-y-3">
      <div className="font-semibold text-base">{contact.name || link.title || "Contact"}</div>
      {contact.role || contact.title ? (
        <div className="text-sm text-muted-foreground">
          {[contact.role, contact.title].filter(Boolean).join(" · ")}
        </div>
      ) : null}
      {contact.note ? <div className="text-sm text-muted-foreground">{contact.note}</div> : null}

      <div className="space-y-1">
        {items.map((item) => item.value ? (
          <div key={item.key} className="flex flex-wrap gap-2 text-sm">
            <span className="font-medium min-w-24 text-muted-foreground">{item.key}</span>
            {item.href ? buildLink(item.href, item.value) : <span>{item.value}</span>}
          </div>
        ) : null)}
      </div>
    </Card>
  );
};
