import { withBasePath } from "@/lib/base-path";

type OrbitPageBrandProps = {
  className?: string;
  showName?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-16 w-16",
} as const;

export function OrbitPageBrand({ className = "", showName = true, size = "md" }: OrbitPageBrandProps) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`.trim()}>
      <img
        alt=""
        className={`${sizeClasses[size]} block shrink-0`}
        height={size === "lg" ? 64 : size === "md" ? 40 : 28}
        src={withBasePath("/brand/orbitpage-mark.svg")}
        width={size === "lg" ? 64 : size === "md" ? 40 : 28}
      />
      {showName && <span className="text-lg font-extrabold leading-none text-current">OrbitPage</span>}
    </span>
  );
}
