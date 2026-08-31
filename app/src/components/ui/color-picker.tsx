"use client";

import ColorizeOutlined from "@mui/icons-material/ColorizeOutlined";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import { HexColorPicker } from "react-colorful";
import {
  type CSSProperties,
  type ChangeEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { isHexColor, normalizeHexColor } from "./color-picker-utils";

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function ColorPicker({
  value,
  onChange,
  label,
  className = "",
  disabled = false,
  id,
}: ColorPickerProps) {
  const generatedId = useId();
  const pickerId = id || `orbit-color-picker-${generatedId.replace(/:/g, "")}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalizeHexColor(value, "#000000"));
  const [eyeDropperSupported, setEyeDropperSupported] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ left: 12, top: 12 });
  const resolvedValue = normalizeHexColor(value, draft);

  useEffect(() => {
    setDraft(normalizeHexColor(value, "#000000"));
  }, [value]);

  useEffect(() => {
    setEyeDropperSupported(typeof window !== "undefined" && "EyeDropper" in window);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const panelWidth = Math.min(296, window.innerWidth - 24);
    const panelHeight = popoverRef.current?.offsetHeight || 326;
    const left = Math.max(12, Math.min(trigger.left, window.innerWidth - panelWidth - 12));
    const below = trigger.bottom + 8;
    const top = below + panelHeight <= window.innerHeight - 12
      ? below
      : Math.max(12, trigger.top - panelHeight - 8);
    setPosition({ left, top, width: panelWidth });
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(updatePosition);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePosition]);

  const commitColor = (nextValue: string) => {
    const normalized = normalizeHexColor(nextValue, resolvedValue);
    setDraft(normalized);
    if (normalized !== resolvedValue) onChange(normalized);
  };

  const handleDraftChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextDraft = event.target.value.toUpperCase().replace(/[^#0-9A-F]/g, "").slice(0, 7);
    setDraft(nextDraft);
    if (isHexColor(nextDraft) && nextDraft.toLowerCase() !== resolvedValue) onChange(nextDraft.toLowerCase());
  };

  const handleEyeDropper = async () => {
    const EyeDropper = (window as typeof window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
    if (!EyeDropper) return;
    try {
      const result = await new EyeDropper().open();
      commitColor(result.sRGBHex);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) console.warn("Eyedropper failed", error);
    }
  };

  const togglePicker = () => {
    if (disabled) return;
    if (!open) updatePosition();
    setOpen((current) => !current);
  };

  const popover = open && typeof document !== "undefined" ? createPortal(
    <div
      aria-label={`${label} color picker`}
      className="orbit-color-picker__popover"
      id={`${pickerId}-popover`}
      ref={popoverRef}
      role="dialog"
      style={position}
    >
      <HexColorPicker color={resolvedValue} onChange={commitColor} />
      <div className="orbit-color-picker__tools">
        <button
          aria-label={`Pick ${label} from the screen`}
          className="orbit-color-picker__eyedropper"
          disabled={!eyeDropperSupported}
          onClick={handleEyeDropper}
          title={eyeDropperSupported ? "Pick a color from the screen" : "Eyedropper is not supported by this browser"}
          type="button"
        >
          <ColorizeOutlined aria-hidden="true" fontSize="small" />
        </button>
        <span className="orbit-color-picker__current" aria-live="polite">
          <i aria-hidden="true" style={{ backgroundColor: resolvedValue }} />
          <span>Selected color</span>
        </span>
      </div>
      <div className="orbit-color-picker__output">
        <span aria-hidden="true">HEX</span>
        <input
          aria-label={`${label} HEX value`}
          autoComplete="off"
          inputMode="text"
          maxLength={7}
          onBlur={() => commitColor(draft)}
          onChange={handleDraftChange}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitColor(draft);
              setOpen(false);
              window.requestAnimationFrame(() => triggerRef.current?.focus());
            }
          }}
          spellCheck={false}
          value={draft.toUpperCase()}
        />
      </div>
      <p className="orbit-color-picker__hint">Opacity is kept at 100% for theme compatibility.</p>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`orbit-color-picker ${className}`.trim()}>
      <button
        aria-controls={`${pickerId}-popover`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label}: ${resolvedValue.toUpperCase()}`}
        className="orbit-color-picker__trigger"
        disabled={disabled}
        id={pickerId}
        onClick={togglePicker}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true" className="orbit-color-picker__swatch" style={{ backgroundColor: resolvedValue }} />
        <code>{resolvedValue.toUpperCase()}</code>
        <ExpandMoreRounded aria-hidden="true" className={open ? "is-open" : ""} fontSize="small" />
      </button>
      {popover}
    </div>
  );
}

export default ColorPicker;
