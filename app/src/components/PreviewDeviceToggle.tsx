import { Monitor, Smartphone } from "./ui/material-icons";

export type PreviewDevice = "mobile" | "desktop";

export function PreviewDeviceToggle({ value, onChange, className = "" }: {
  value: PreviewDevice; onChange: (device: PreviewDevice) => void; className?: string;
}) {
  return <div className={`admin-preview-device-toggle ${className}`} role="group" aria-label="Preview device">
    <button type="button" className={value === "mobile" ? "active" : ""} aria-pressed={value === "mobile"} aria-label="Mobile preview" title="Mobile preview" onClick={() => onChange("mobile")}><Smartphone className="h-4 w-4" /></button>
    <button type="button" className={value === "desktop" ? "active" : ""} aria-pressed={value === "desktop"} aria-label="Desktop preview" title="Desktop preview" onClick={() => onChange("desktop")}><Monitor className="h-4 w-4" /></button>
  </div>;
}
