import * as React from "react";

import { cn } from "@/lib/utils";

type ComparisonContextValue = {
  position: number;
  setPosition: (position: number) => void;
};

const ComparisonContext = React.createContext<ComparisonContextValue | null>(null);

const clampPosition = (position: number) => Math.min(100, Math.max(0, position));

interface ComparisonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
}

const Comparison = React.forwardRef<HTMLDivElement, ComparisonProps>(({
  className,
  children,
  defaultValue = 50,
  onValueChange,
  style,
  value,
  ...props
}, ref) => {
  const [internalPosition, setInternalPosition] = React.useState(() => clampPosition(defaultValue));
  const position = clampPosition(value ?? internalPosition);
  const setPosition = React.useCallback((nextPosition: number) => {
    const clampedPosition = clampPosition(nextPosition);
    if (value === undefined) setInternalPosition(clampedPosition);
    onValueChange?.(clampedPosition);
  }, [onValueChange, value]);
  const contextValue = React.useMemo(() => ({ position, setPosition }), [position, setPosition]);

  return (
    <ComparisonContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={cn("relative isolate overflow-hidden", className)}
        data-comparison=""
        data-comparison-value={position}
        style={{
          ...style,
          "--comparison-position": `${position}%`,
        } as React.CSSProperties}
        {...props}
      >
        {children}
      </div>
    </ComparisonContext.Provider>
  );
});
Comparison.displayName = "Comparison";

interface ComparisonItemProps extends React.HTMLAttributes<HTMLDivElement> {
  position: "left" | "right";
}

const ComparisonItem = React.forwardRef<HTMLDivElement, ComparisonItemProps>(({
  className,
  position,
  style,
  ...props
}, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(
      "pointer-events-none select-none",
      position === "left" ? "relative" : "absolute inset-0 z-[1]",
      className,
    )}
    data-comparison-item={position}
    inert=""
    style={position === "right" ? {
      ...style,
      clipPath: "inset(0 0 0 var(--comparison-position))",
    } : style}
    {...props}
  />
));
ComparisonItem.displayName = "ComparisonItem";

interface ComparisonHandleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "max" | "min" | "onChange" | "step" | "type" | "value"> {
  afterLabel?: string;
  beforeLabel?: string;
  label?: string;
}

const ComparisonHandle = React.forwardRef<HTMLInputElement, ComparisonHandleProps>(({
  afterLabel = "After",
  beforeLabel = "Before",
  className,
  label = "Compare before and after",
  ...props
}, ref) => {
  const context = React.useContext(ComparisonContext);
  if (!context) throw new Error("ComparisonHandle must be used inside Comparison");

  const beforeAmount = Math.round(context.position);
  const afterAmount = 100 - beforeAmount;

  return (
    <>
      <input
        ref={ref}
        type="range"
        min={0}
        max={100}
        step={1}
        value={context.position}
        aria-label={label}
        aria-valuetext={`${beforeLabel} ${beforeAmount}%, ${afterLabel} ${afterAmount}%`}
        className={cn(
          "peer absolute inset-0 z-20 h-full w-full cursor-ew-resize touch-pan-y appearance-none opacity-0",
          className,
        )}
        onChange={(event) => context.setPosition(event.currentTarget.valueAsNumber)}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(15_23_42_/_0.32),0_0_18px_rgb(15_23_42_/_0.28)]"
        style={{ left: `${context.position}%` }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-slate-950 text-white shadow-xl transition-[box-shadow,transform] peer-focus-visible:ring-4 peer-focus-visible:ring-blue-500/40 peer-focus-visible:ring-offset-2"
        style={{ left: `${context.position}%` }}
      >
        <span className="flex items-center gap-0.5">
          <i className="block h-3.5 w-0.5 rounded-full bg-white/80" />
          <i className="block h-5 w-0.5 rounded-full bg-white" />
          <i className="block h-3.5 w-0.5 rounded-full bg-white/80" />
        </span>
      </span>
    </>
  );
});
ComparisonHandle.displayName = "ComparisonHandle";

export { Comparison, ComparisonHandle, ComparisonItem };
