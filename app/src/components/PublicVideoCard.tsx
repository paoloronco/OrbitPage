import { useState } from "react";
import { Card } from "@/components/ui/card";
import type { LinkData } from "./LinkCard";
import { internalAssetPath } from "@/lib/base-path";
import { getVideoData } from "@/lib/link-blocks";
import { getPublicBlockPadding, getPublicBlockStyle } from "@/lib/public-block-style";
import { VideoOff } from "lucide-react";

const resolveMediaUrl = (value?: string) => {
  if (!value) return undefined;
  if (/^(https?:|blob:)/i.test(value)) return value;
  return internalAssetPath(value);
};

export const PublicVideoCard = ({ link }: { link: LinkData }) => {
  const [videoError, setVideoError] = useState(false);
  const data = getVideoData(link.content);
  const mediaUrl = resolveMediaUrl(data.mediaUrl);
  const posterUrl = resolveMediaUrl(data.posterUrl || link.coverImage);
  const hasCaption = Boolean(link.title || link.description);

  if (!mediaUrl) return null;

  return (
    <Card className="glass-card overflow-hidden p-0" style={getPublicBlockStyle(link)}>
      <div className="relative aspect-video w-full overflow-hidden bg-black/90">
        {videoError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/70" role="status">
            <VideoOff className="h-6 w-6" />
            <span className="text-sm">Video unavailable</span>
          </div>
        ) : (
          <video
            src={mediaUrl}
            poster={posterUrl}
            controls={data.controls}
            autoPlay={data.autoplay}
            muted={data.autoplay || data.muted}
            loop={data.loop}
            playsInline
            preload="metadata"
            onError={() => setVideoError(true)}
            className="h-full w-full"
            style={{ objectFit: data.objectFit }}
          />
        )}
      </div>
      {hasCaption ? (
        <div className={getPublicBlockPadding(link.size)}>
          {link.title ? <p className="text-sm font-semibold leading-tight">{link.title}</p> : null}
          {link.description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{link.description}</p> : null}
        </div>
      ) : null}
    </Card>
  );
};
