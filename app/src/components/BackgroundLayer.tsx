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

  // Background video is author-selected page content, so keep it playing even when
  // reduced motion is enabled. Decorative GIFs still honor that preference below.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || config.type !== "video") return;

    const play = () => {
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      if (document.visibilityState !== "visible") return;
      void v.play().catch((err: Error) => {
        // A concurrent source/navigation change can legitimately cancel play().
        if (err.name !== "AbortError") {
          console.warn("[OrbitPage] Background video autoplay failed:", err.name, "-", err.message);
        }
      });
    };

    play();
    v.addEventListener("canplay", play);
    window.addEventListener("pageshow", play);
    document.addEventListener("visibilitychange", play);
    return () => {
      v.removeEventListener("canplay", play);
      window.removeEventListener("pageshow", play);
      document.removeEventListener("visibilitychange", play);
    };
  }, [config.mediaUrl, config.type]);

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
          autoPlay
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
