import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { apiPath } from "@/lib/base-path";
import { getEventData } from "@/lib/link-blocks";
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Ticket } from "lucide-react";
import { getPublicBlockPadding, getPublicBlockStyle, getPublicIconContent } from "@/lib/public-block-style";

interface PublicEventCardProps {
  link: LinkData;
}

export const PublicEventCard = ({ link }: PublicEventCardProps) => {
  const eventData = getEventData(link.content);
  const hasData = Boolean(eventData.date || eventData.location || eventData.time || eventData.notes);
  const dateLabel = eventData.date || "Date";
  const timeLabel = [eventData.time, eventData.endTime ? `- ${eventData.endTime}` : ""].filter(Boolean).join(" ");
  const cardStyle = getPublicBlockStyle(link);

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
    <Card className="glass-card overflow-hidden p-0" style={cardStyle}>
      <div className="flex">
        <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-primary/12 px-3 py-5 text-center text-primary ring-1 ring-inset ring-primary/15">
          <span className="mb-2 flex h-6 w-6 items-center justify-center">
            {getPublicIconContent(link, <CalendarDays className="h-5 w-5" />)}
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.12em]">Event</span>
        </div>
        <div className={`min-w-0 flex-1 space-y-3 ${getPublicBlockPadding(link.size)}`}>
          <div>
            <p
              className="text-base font-semibold leading-tight"
              style={{
                ...(link.titleFontSize ? { fontSize: link.titleFontSize } : {}),
                ...(link.titleFontFamily ? { fontFamily: link.titleFontFamily } : {}),
              }}
            >
              {link.title || "Event"}
            </p>
            {link.description ? (
              <p
                className="mt-1 text-sm leading-relaxed text-muted-foreground"
                style={{
                  ...(link.textColor ? { color: link.textColor, opacity: 0.78 } : {}),
                  ...(link.descriptionFontSize ? { fontSize: link.descriptionFontSize } : {}),
                  ...(link.descriptionFontFamily ? { fontFamily: link.descriptionFontFamily } : {}),
                }}
              >
                {link.description}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 text-sm">
            {(eventData.date || eventData.time || eventData.endDate || eventData.endTime) ? (
              <div className="flex items-start gap-2 rounded-md bg-muted/35 px-3 py-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {dateLabel}{eventData.endDate ? ` - ${eventData.endDate}` : ""}{timeLabel ? `, ${timeLabel}` : ""}
                </span>
              </div>
            ) : null}
            {eventData.location ? (
              <div className="flex items-start gap-2 rounded-md bg-muted/35 px-3 py-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="break-words">{eventData.location}</span>
              </div>
            ) : null}
            {eventData.notes ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{eventData.notes}</p>
            ) : null}
          </div>
        {link.url ? (
          <button
            type="button"
            onClick={handleOpen}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-smooth hover:bg-primary/90"
          >
              <Ticket className="h-4 w-4" />
            {eventData.ticketLabel || "Get ticket"}
              <ArrowUpRight className="h-4 w-4" />
          </button>
        ) : null}
        </div>
      </div>
    </Card>
  );
};
