"use client";

import { createElement, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";

type RangeSliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "size" | "type" | "value"
> & {
  max?: number;
  min?: number;
  size?: "small" | "medium";
  value: number;
  valueLabel?: ReactNode;
  valueLabelDisplay?: "auto" | "on" | "off";
};

export default function RangeSlider({
  className,
  max = 100,
  min = 0,
  size = "medium",
  value,
  valueLabel = value,
  valueLabelDisplay = "auto",
  ...props
}: RangeSliderProps) {
  const numericValue = Number(value);
  const denominator = max - min;
  const percentage = denominator > 0
    ? Math.min(100, Math.max(0, ((numericValue - min) / denominator) * 100))
    : 0;

  return createElement(
    "span",
    {
      className: [
        "orbit-range-slider",
        size === "small" ? "is-small" : "is-medium",
        className,
      ].filter(Boolean).join(" "),
      "data-value-label": valueLabelDisplay,
      style: { "--range-progress": `${percentage}%` } as CSSProperties,
    },
    createElement("input", { ...props, max, min, type: "range", value: numericValue }),
    valueLabelDisplay === "off"
      ? null
      : createElement("span", {
        "aria-hidden": true,
        className: "orbit-range-slider__value",
      }, valueLabel),
  );
}

export type { RangeSliderProps };
