import { useState } from "react";
import { Card } from "@/components/ui/card";
import { LinkData } from "./LinkCard";
import { apiPath, internalAssetPath } from "@/lib/base-path";

interface PublicImageCardProps {
  link: LinkData;
}

const resolveImageUrl = (src?: string | null) => {
  if (!src) return null;
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("http")) return src;
  return internalAssetPath(src);
};

export const PublicImageCard = ({ link }: PublicImageCardProps) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = resolveImageUrl(link.coverImage || link.url);
  const hasCaption = Boolean(link.description);

  const trackClick = () => {
    if (!link.url) return;
    fetch(apiPath(`/links/${encodeURIComponent(link.id)}/click`), { method: 'POST' }).catch(() => {});
  };

  if (!imageUrl) {
    return null;
  }

  return (
    <Card className="glass-card overflow-hidden transition-smooth p-0">
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => {
          if (link.url) {
            trackClick();
            window.open(link.url, "_blank", "noopener,noreferrer");
          }
        }}
        disabled={!link.url}
      >
        <img
          src={imageUrl}
          alt={link.title || "Image block"}
          onError={() => setImageError(true)}
          className="w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </button>
      {hasCaption ? (
        <div className="px-4 py-3" style={imageError ? { opacity: 0.75 } : undefined}>
          <p className="text-sm text-muted-foreground">{link.title || link.description}</p>
          {link.description && link.title && (
            <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
          )}
        </div>
      ) : (
        <div className="px-4 py-2">
          <p className="text-sm text-muted-foreground">{link.title || "Image"}</p>
        </div>
      )}
    </Card>
  );
};

