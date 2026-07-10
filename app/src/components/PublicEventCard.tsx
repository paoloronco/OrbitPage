import { Card } from "@/components/ui/card";
import { LinkData } from "./LinkCard";
import { apiPath } from "@/lib/base-path";
import { getEventData } from "@/lib/link-blocks";

interface PublicEventCardProps {
  link: LinkData;
}

export const PublicEventCard = ({ link }: PublicEventCardProps) => {
  const eventData = getEventData(link.content);
  const hasData = Boolean(eventData.date || eventData.location || eventData.time || eventData.notes);

  const handleOpen = () => {
    if (link.url) {
      fetch(apiPath(`/links/${encodeURIComponent(link.id)}/click`), { method: 'POST' }).catch(() => {});
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  };

  if (!hasData && !link.title && !link.description) {
    return null;
  }

  return (
    <Card className="glass-card">
      <div className="space-y-2">
        <p className="font-semibold">{link.title || "Event"}</p>
        {link.description ? <p className="text-sm text-muted-foreground">{link.description}</p> : null}
        <div className="text-sm text-muted-foreground space-y-1">
          {eventData.date || eventData.time || eventData.endDate || eventData.endTime ? (
            <p>
              {eventData.date || "Date"} {eventData.time ? `· ${eventData.time}` : ""}
              {eventData.endDate || eventData.endTime
                ? ` → ${eventData.endDate || eventData.date || ""} ${eventData.endTime || ""}`.trim()
                : ""}
            </p>
          ) : null}
          {eventData.location ? <p>{eventData.location}</p> : null}
          {eventData.ticketLabel ? <p className="font-medium text-foreground">{eventData.ticketLabel}</p> : null}
          {eventData.notes ? <p>{eventData.notes}</p> : null}
        </div>
        {link.url ? (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex h-9 items-center rounded-md border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-primary/5"
          >
            {eventData.ticketLabel || "Get ticket"}
          </button>
        ) : null}
      </div>
    </Card>
  );
};

