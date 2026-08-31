import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  size?: "small" | "medium";
  valueLabelDisplay?: "auto" | "on" | "off";
  valueLabelFormat?: (value: number) => React.ReactNode;
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({
  className,
  defaultValue,
  max = 100,
  min = 0,
  onValueChange,
  size = "medium",
  value,
  valueLabelDisplay = "auto",
  valueLabelFormat = (currentValue) => currentValue,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}, ref) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<number[]>(
    defaultValue ?? [min],
  );
  const visibleValues = value ?? uncontrolledValue;

  const handleValueChange = (nextValue: number[]) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
  };

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "admin-range-control group/slider relative flex w-full touch-none select-none items-center data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        size === "small" ? "!min-h-8" : "!min-h-9",
        className,
      )}
      defaultValue={defaultValue}
      max={max}
      min={min}
      onValueChange={handleValueChange}
      value={value}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "admin-range-track relative w-full grow overflow-hidden rounded-full !bg-slate-200 shadow-inner",
          size === "small" ? "!h-1" : "!h-1.5",
        )}
      >
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-[#3568f4]" />
      </SliderPrimitive.Track>
      {visibleValues.map((currentValue, index) => (
        <SliderPrimitive.Thumb
          aria-label={index === 0 ? ariaLabel : ariaLabel ? `${ariaLabel} ${index + 1}` : undefined}
          aria-labelledby={index === 0 ? ariaLabelledBy : undefined}
          className={cn(
            "admin-range-thumb group/thumb relative block shrink-0 rounded-full !border-[3px] !border-white !bg-[#3568f4] shadow-md ring-1 ring-blue-700/20 transition-[transform,box-shadow] duration-150 ease-out hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 disabled:pointer-events-none disabled:opacity-50",
            size === "small" ? "!h-4 !w-4" : "!h-5 !w-5",
          )}
          key={index}
        >
          {valueLabelDisplay !== "off" ? (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-20 -translate-x-1/2 rounded-md bg-slate-950 px-2 py-1 text-[11px] font-bold leading-none text-white shadow-lg after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-950",
                valueLabelDisplay === "on"
                  ? "opacity-100"
                  : "translate-y-1 opacity-0 transition-[opacity,transform] duration-150 group-hover/thumb:translate-y-0 group-hover/thumb:opacity-100 group-focus/thumb:translate-y-0 group-focus/thumb:opacity-100 group-active/thumb:translate-y-0 group-active/thumb:opacity-100",
              )}
            >
              {valueLabelFormat(currentValue)}
            </span>
          ) : null}
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
});

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
export type { SliderProps };
