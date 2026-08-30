import type { CSSProperties } from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { cn } from "@/lib/utils";

type OrbitLoaderProps = {
  className?: string;
  size?: number;
  state?: OrbState;
  bare?: boolean;
};

type OrbitLoadingStateProps = {
  className?: string;
  compact?: boolean;
  description?: string;
  state?: OrbState;
  title: string;
};

type LoaderStyle = CSSProperties & { "--orbit-loader-size": string };

/** OrbitPage's branded wrapper around the MIT-licensed thinking-orbs canvas. */
export function OrbitLoader({
  bare = false,
  className,
  size = 20,
  state = "working",
}: OrbitLoaderProps) {
  const preset = size > 32 ? 64 : 20;

  return (
    <span
      aria-hidden="true"
      className={cn("orbit-loader", bare && "orbit-loader--bare", className)}
      data-orbit-state={state}
      style={{ "--orbit-loader-size": `${size}px` } as LoaderStyle}
    >
      <ThinkingOrb
        aria-hidden="true"
        className="orbit-loader__canvas"
        size={preset}
        state={state}
        style={{ height: "100%", width: "100%" }}
        theme="dark"
      />
    </span>
  );
}

export function OrbitLoadingState({
  className,
  compact = false,
  description,
  state = "working",
  title,
}: OrbitLoadingStateProps) {
  return (
    <div
      aria-live="polite"
      className={cn("orbit-loading-state", compact && "orbit-loading-state--compact", className)}
      role="status"
    >
      <span className="orbit-loading-state__orb" aria-hidden="true">
        <OrbitLoader bare size={compact ? 40 : 64} state={state} />
      </span>
      <span className="orbit-loading-state__copy">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </span>
    </div>
  );
}
