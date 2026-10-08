"use client";

import {
  createElement,
  type InputHTMLAttributes,
} from "react";

type ToggleSwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "checked" | "onChange" | "size" | "type"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: "small" | "medium";
};

export default function ToggleSwitch({
  checked,
  className,
  disabled,
  onCheckedChange,
  size = "medium",
  ...inputProps
}: ToggleSwitchProps) {
  return createElement(
    "span",
    {
      className: [
        "orbit-switch",
        size === "small" ? "is-small" : "is-medium",
        className,
      ].filter(Boolean).join(" "),
      "data-disabled": disabled ? "true" : undefined,
      "data-state": checked ? "checked" : "unchecked",
    },
    createElement("input", {
      ...inputProps,
      checked,
      className: "orbit-switch__input",
      disabled,
      onChange: (event) => onCheckedChange(event.currentTarget.checked),
      role: inputProps.role ?? "switch",
      type: "checkbox",
    }),
    createElement(
      "span",
      { "aria-hidden": true, className: "orbit-switch__track" },
      createElement("span", { className: "orbit-switch__thumb" }),
    ),
  );
}

export type { ToggleSwitchProps };
