import { useEffect, useRef, useState, CSSProperties } from "react";
import { BackgroundMediaConfig } from "@/lib/theme";

interface BackgroundLayerProps {
  config: BackgroundMediaConfig;
}

export const BackgroundLayer = ({ config }: BackgroundLayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Pause/resume video when reduced motion preference changes
  useEffect(() => {
    if (!videoRef.current) return;
    if (prefersReducedMotion) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [prefersReducedMotion]);

  if (config.type !== "video" && config.type !== "gif") return null;
  if (!config.mediaUrl) return null;

  // Build CSS filter string
  const filters: string[] = [];
  if (config.blur > 0) filters.push(`blur(${config.blur}px)`);
  if (config.brightness !== 1) filters.push(`brightness(${config.brightness})`);
  if (config.saturation !== 1) filters.push(`saturate(${config.saturation})`);
  if (config.contrast !== 1) filters.push(`contrast(${config.contrast})`);
  const filterString = filters.length > 0 ? filters.join(" ") : undefined;

  // Extra scale to hide blur edges when blur is active
  const blurEdgeScale = config.blur > 0 ? 1 + config.blur * 0.025 : 1;
  const totalScale = config.scale * blurEdgeScale;

  const mediaStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: config.objectFit,
    opacity: config.opacity,
    filter: filterString,
    transform: totalScale !== 1 ? `scale(${totalScale})` : undefined,
    willChange: config.type === "video" ? "transform" : undefined,
  };

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {config.type === "video" ? (
        <video
          ref={videoRef}
          src={config.mediaUrl}
          autoPlay={!prefersReducedMotion}
          muted
          loop
          playsInline
          preload="auto"
          style={mediaStyle}
        />
      ) : (
        // GIF — hidden when user prefers reduced motion
        <img
          src={config.mediaUrl}
          alt=""
          role="presentation"
          style={{
            ...mediaStyle,
            display: prefersReducedMotion ? "none" : undefined,
          }}
        />
      )}

      {/* Overlay */}
      {config.overlayOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: config.overlayColor,
            opacity: config.overlayOpacity,
          }}
        />
      )}
    </div>
  );
};
