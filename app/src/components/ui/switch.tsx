import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  size?: "small" | "medium"
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = "medium", style, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-0 !bg-transparent p-0 align-middle outline-none before:absolute before:left-1 before:right-1 before:top-1/2 before:-translate-y-1/2 before:rounded-full before:bg-[var(--switch-track)] before:opacity-40 before:transition-[background-color,opacity] before:duration-150 before:ease-out hover:before:opacity-55 focus-visible:ring-4 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:before:bg-[var(--switch-accent)] data-[state=checked]:before:opacity-45",
      size === "small"
        ? "!h-6 !min-h-6 !w-10 !min-w-10 before:h-3"
        : "!h-7 !min-h-7 !w-11 !min-w-11 before:h-3.5",
      className
    )}
    style={{
      "--switch-accent": "#3568f4",
      "--switch-track": "#708096",
      ...style,
    } as React.CSSProperties}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none relative z-10 ml-[3px] block rounded-full bg-[#f8fbff] shadow-[0_1px_4px_rgb(18_42_79/28%)] ring-1 ring-slate-700/10 transition-[background-color,box-shadow,transform] duration-150 ease-out group-hover/switch:shadow-[0_2px_7px_rgb(18_42_79/30%),0_0_0_6px_rgb(53_104_244/10%)] data-[state=checked]:!translate-x-[18px] data-[state=checked]:bg-[var(--switch-accent)] data-[state=unchecked]:!translate-x-0",
        size === "small" ? "!h-4 !w-4" : "!h-5 !w-5",
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
export type { SwitchProps }
