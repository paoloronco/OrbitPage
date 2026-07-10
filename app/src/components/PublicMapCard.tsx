import { Card } from "@/components/ui/card";
import { LinkData } from "./LinkCard";
import { apiPath } from "@/lib/base-path";
import { getMapData } from "@/lib/link-blocks";

interface PublicMapCardProps {
  link: LinkData;
}

export const PublicMapCard = ({ link }: PublicMapCardProps) => {
  const { placeName, address, mapUrl } = getMapData(link.content);
  const resolvedMapUrl = mapUrl || (address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "");

  const handleOpen = () => {
    if (resolvedMapUrl) {
      fetch(apiPath(`/links/${encodeURIComponent(link.id)}/click`), { method: 'POST' }).catch(() => {});
      window.open(resolvedMapUrl, "_blank", "noopener,noreferrer");
    }
  };

  const hasContent = Boolean(placeName || address);
  if (!hasContent) {
    return null;
  }

  return (
    <Card className="glass-card">
      <div className="space-y-2">
        <p className="font-semibold">{placeName || "Map"} </p>
        {address ? <p className="text-sm text-muted-foreground whitespace-pre-wrap">{address}</p> : null}
        {resolvedMapUrl ? (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex h-9 items-center rounded-md border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-primary/5"
          >
            Open map
          </button>
        ) : null}
      </div>
    </Card>
  );
};

