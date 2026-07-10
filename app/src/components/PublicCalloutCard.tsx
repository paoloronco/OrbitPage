import { Card } from "@/components/ui/card";
import { LinkData } from "./LinkCard";
import { getCalloutData } from "@/lib/link-blocks";
import { apiPath } from "@/lib/base-path";

interface PublicCalloutCardProps {
  link: LinkData;
}

export const PublicCalloutCard = ({ link }: PublicCalloutCardProps) => {
  const { badge, buttonLabel } = getCalloutData(link.content);

  const handleOpen = () => {
    if (link.url) {
      fetch(apiPath(`/links/${encodeURIComponent(link.id)}/click`), { method: 'POST' }).catch(() => {});
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  };

  if (!link.title && !link.description) {
    return null;
  }

  return (
    <Card className="glass-card border-primary/30 bg-primary/5">
      <div className="space-y-2">
        {badge ? (
          <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            {badge}
          </span>
        ) : null}
        {link.title && <p className="font-semibold">{link.title}</p>}
        {link.description && <p className="text-sm text-muted-foreground">{link.description}</p>}
        {link.url ? (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex h-9 items-center rounded-md border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white transition-smooth"
          >
            {buttonLabel || "Open"}
          </button>
        ) : null}
      </div>
    </Card>
  );
};

