import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { trackPublicLinkClick } from "@/lib/public-runtime";
import { getEventData } from "@/lib/link-blocks";
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Ticket } from "lucide-react";
import { getPublicAccentStyle, getPublicBlockPadding, getPublicBlockStyle, getPublicButtonStyle, getPublicIconContent } from "@/lib/public-block-style";
import { countdownParts, eventDateTime } from "@/lib/event-countdown";
import { useAppI18n } from "@/lib/i18n";

interface PublicEventCardProps {
  link: LinkData;
}

export const PublicEventCard = ({ link }: PublicEventCardProps) => {
  const { tr } = useAppI18n();
  const eventData = getEventData(link.content);
  const hasData = Boolean(eventData.date || eventData.location || eventData.time || eventData.notes);
  const dateLabel = eventData.date || "Date";
  const timeLabel = [eventData.time, eventData.endTime ? `- ${eventData.endTime}` : ""].filter(Boolean).join(" ");
  const cardStyle = getPublicBlockStyle(link);
  const unavailable = link.availability === 'unavailable';
  const eventInstant = useMemo(
    () => eventData.date
      ? eventDateTime(eventData.date, eventData.time || '00:00', eventData.timezone || link.timezone || 'UTC')
      : null,
    [eventData.date, eventData.time, eventData.timezone, link.timezone],
  );
  const [now, setNow] = useState(() => new Date());
  const countdown = eventData.showCountdown !== false ? countdownParts(eventInstant, now) : null;

  useEffect(() => {
    if (eventData.showCountdown === false || !eventInstant || eventInstant.getTime() <= Date.now()) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, [eventData.showCountdown, eventInstant]);

  const handleOpen = () => {
    if (link.url && !unavailable) {
      trackPublicLinkClick(link.id);
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  };

  if (!hasData && !link.title && !link.description) {
    return null;
  }

  return (
    <Card className="glass-card overflow-hidden p-0" style={cardStyle}>
      <div className="flex">
        <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-primary/12 px-3 py-5 text-center text-primary ring-1 ring-inset ring-primary/15" style={getPublicAccentStyle(link)}>
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
            {countdown ? (
              <div className="grid grid-cols-4 gap-1.5 rounded-md bg-primary/10 p-2" aria-label="Time remaining until the event">
                {([
                  [tr('Days', 'Giorni'), countdown.days],
                  [tr('Hours', 'Ore'), countdown.hours],
                  ['Min', countdown.minutes],
                  ['Sec', countdown.seconds],
                ] as const).map(([label, value]) => (
                  <span key={label} className="min-w-0 rounded bg-background/55 px-1 py-1.5 text-center tabular-nums">
                    <strong className="block text-sm leading-none">{String(value).padStart(2, '0')}</strong>
                    <span className="mt-1 block truncate text-[9px] font-semibold uppercase tracking-[0.08em] opacity-65">{label}</span>
                  </span>
                ))}
              </div>
            ) : null}
            {(eventData.date || eventData.time || eventData.endDate || eventData.endTime) ? (
              <div className="flex items-start gap-2 rounded-md bg-muted/35 px-3 py-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" style={getPublicAccentStyle(link)} />
                <span>
                  {dateLabel}{eventData.endDate ? ` - ${eventData.endDate}` : ""}{timeLabel ? `, ${timeLabel}` : ""}
                </span>
              </div>
            ) : null}
            {eventData.location ? (
              <div className="flex items-start gap-2 rounded-md bg-muted/35 px-3 py-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" style={getPublicAccentStyle(link)} />
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
              disabled={unavailable}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-smooth hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55"
              style={getPublicButtonStyle(link)}
          >
              <Ticket className="h-4 w-4" />
            {unavailable ? tr('Unavailable', 'Non disponibile') : eventData.ticketLabel || tr('Get ticket', 'Biglietti')}
              <ArrowUpRight className="h-4 w-4" />
          </button>
        ) : null}
        </div>
      </div>
    </Card>
  );
};
