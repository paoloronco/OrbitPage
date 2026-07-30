import { withRuntimeAssetPath } from "@/lib/base-path";

type OrbitPageBrandProps = {
  className?: string;
  showName?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
};

const sizeClasses = {
  xs: "h-5 w-5",
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-16 w-16",
} as const;

export function OrbitPageBrand({ className = "", showName = true, size = "md" }: OrbitPageBrandProps) {
  const pixels = size === "lg" ? 64 : size === "md" ? 40 : size === "sm" ? 28 : 20;
  return (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`.trim()}>
      <img
        alt=""
        className={`${sizeClasses[size]} block shrink-0`}
        height={pixels}
        src={withRuntimeAssetPath("/brand/orbitpage-mark-192.png")}
        width={pixels}
      />
      {showName && (
        <span className={`${size === "xs" ? "text-sm" : "text-lg"} whitespace-nowrap leading-none tracking-[-0.045em] text-current`}>
          <span className="font-extrabold">Orbit</span>
          <span className="font-medium">Page</span>
        </span>
      )}
    </span>
  );
}
