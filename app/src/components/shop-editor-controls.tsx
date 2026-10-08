"use client";

import { Bold, Heading2, HelpCircle, Italic, List, UploadCloud, X } from "lucide-react";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import RangeSlider from "./ui/range-slider";

export function ShopHelp({ label, text, disablePortal = false }: { label: string; text: string; disablePortal?: boolean }) {
  const [open, setOpen] = useState(false);
  return <Tooltip describeChild disableTouchListener onClose={() => setOpen(false)} onOpen={() => setOpen(true)} open={open} placement="bottom" slotProps={{ popper: { disablePortal } }} title={text}><button aria-label={label} className="shop-help" onBlur={() => setOpen(false)} onClick={() => setOpen(true)} type="button"><HelpCircle aria-hidden="true" size={16} /></button></Tooltip>;
}

export function ShopDialog({ title, help, children, onClose, busy = false, dirty = false, className = "", style }: { title: string; help?: string; children: ReactNode; onClose: () => void; busy?: boolean; dirty?: boolean; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDialogElement>(null);
  const outsidePointerDown = useRef(false);
  const id = useId();
  const isBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
  };
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog aria-labelledby={id} className={`shop-editor-dialog ${className}`} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onPointerDown={(event) => { outsidePointerDown.current = event.button === 0 && isBackdrop(event); }} onClick={(event) => { if (outsidePointerDown.current && isBackdrop(event) && !busy && !dirty) onClose(); }} ref={ref} style={style}>
    <header><div className="shop-dialog-title"><h2 id={id}>{title}</h2>{help && <ShopHelp disablePortal label={`About ${title}`} text={help} />}</div><button aria-label={`Close ${title}`} disabled={busy} onClick={onClose} type="button"><X size={18} /></button></header>
    {children}
  </dialog>, document.body);
}

export function ShopDescriptionField({ label, value, maxLength, onChange, required = true }: { label: string; value: string; maxLength: number; onChange: (value: string) => void; required?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState("");
  function format(kind: "bold" | "italic" | "heading" | "list") {
    const field = ref.current;
    if (!field) return;
    const start = field.selectionStart, end = field.selectionEnd;
    const selected = value.slice(start, end) || "Text";
    const replacement = kind === "bold" ? `**${selected}**` : kind === "italic" ? `*${selected}*` : kind === "heading" ? `## ${selected}` : selected.split("\n").map((line) => `- ${line}`).join("\n");
    const next = value.slice(0, start) + replacement + value.slice(end);
    if (next.length > maxLength) { setError(`Keep this description within ${maxLength} characters.`); return; }
    setError(""); onChange(next);
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start, start + replacement.length); });
  }
  return <div className="shop-description-field"><label htmlFor={id}>{label}</label><div className="shop-rich-field"><div aria-label={`${label} formatting`} className="shop-format-toolbar" role="toolbar">
    <button aria-label="Bold" onClick={() => format("bold")} title="Bold" type="button"><Bold size={16} /></button>
    <button aria-label="Italic" onClick={() => format("italic")} title="Italic" type="button"><Italic size={16} /></button>
    <button aria-label="Heading 2" onClick={() => format("heading")} title="Heading 2" type="button"><Heading2 size={17} /></button>
    <button aria-label="Bulleted list" onClick={() => format("list")} title="Bulleted list" type="button"><List size={17} /></button>
  </div><textarea id={id} maxLength={maxLength} onChange={(event) => { setError(""); onChange(event.target.value); }} ref={ref} required={required} rows={maxLength < 1000 ? 3 : 6} value={value} /></div><small>{value.length}/{maxLength}{error && <span role="alert"> · {error}</span>}</small></div>;
}

export function ShopLogoDialog({ onClose, onApply }: { onClose: () => void; onApply: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [ratio, setRatio] = useState("original");
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0), [y, setY] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const bitmap = useRef<ImageBitmap | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const aspect = ratio === "original" ? Math.max(.5, Math.min(8, dimensions.width / (dimensions.height || 1))) : Number(ratio);
  useEffect(() => {
    let canceled = false;
    setDimensions({ width: 0, height: 0 }); setZoom(1); setX(0); setY(0); setError("");
    if (!file) return;
    if (!file.type.startsWith("image/") || !file.size || file.size > 5 * 1024 * 1024) { setError("Choose an image of 5 MB or less."); return; }
    void createImageBitmap(file).then((image) => {
      if (canceled) { image.close(); return; }
      if (image.width > 8192 || image.height > 8192) { image.close(); setError("Choose an image no larger than 8192 pixels on either side."); return; }
      bitmap.current = image; setDimensions({ width: image.width, height: image.height });
    }).catch(() => { if (!canceled) setError("This image could not be opened. Choose a JPEG, PNG, WebP, AVIF or GIF."); });
    return () => { canceled = true; bitmap.current?.close(); bitmap.current = null; };
  }, [file]);
  useEffect(() => {
    const field = canvas.current, image = bitmap.current;
    if (!field || !image || !dimensions.width) return;
    field.width = 1200; field.height = Math.round(1200 / aspect);
    const context = field.getContext("2d");
    if (!context) return;
    const fit = Math.min(field.width / image.width, field.height / image.height) * zoom;
    const width = image.width * fit, height = image.height * fit;
    context.clearRect(0, 0, field.width, field.height);
    context.drawImage(image, (field.width - width) / 2 + x * field.width / 2, (field.height - height) / 2 + y * field.height / 2, width, height);
  }, [dimensions, aspect, zoom, x, y]);
  async function apply() {
    if (!canvas.current || !dimensions.width) return;
    setBusy(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The logo could not be prepared.")), "image/png"));
      if (blob.size > 5 * 1024 * 1024) throw new Error("The prepared logo exceeds 5 MB. Choose a simpler image.");
      onApply(new File([blob], "shop-logo.png", { type: "image/png" }));
    } catch (error) { setError(error instanceof Error ? error.message : "The logo could not be prepared."); }
    finally { setBusy(false); }
  }
  return <ShopDialog busy={busy} dirty={Boolean(file)} help="Recommended: a transparent PNG. Logo: 500 × 300 px or wordmark: 1200 × 300 px. Up to 5 MB." onClose={onClose} title="Shop logo">
    <label className="shop-logo-upload"><UploadCloud size={20} /><span>Choose an image</span><input accept="image/png,image/jpeg,image/webp,image/avif,image/gif" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] || null)} type="file" /></label>
    {dimensions.width > 0 && <><canvas aria-label="Logo crop preview" className="shop-logo-canvas" onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!drag.current) return; const box = event.currentTarget.getBoundingClientRect(); setX((x) => Math.max(-1, Math.min(1, x + (event.clientX - drag.current!.x) * 2 / box.width))); setY((y) => Math.max(-1, Math.min(1, y + (event.clientY - drag.current!.y) * 2 / box.height))); drag.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} ref={canvas} style={{ aspectRatio: aspect }} />
      <label>Proportions<select disabled={busy} onChange={(event) => setRatio(event.target.value)} value={ratio}><option value="original">Original proportions</option><option value="1">Square</option><option value="4">Wide · 4:1</option><option value="6">Extra wide · 6:1</option></select></label>
      <label>Zoom<RangeSlider aria-label="Logo zoom" max={3} min={1} onChange={(event) => setZoom(Number(event.target.value))} step={.05} value={zoom} valueLabelDisplay="off" /></label>
      <label>Horizontal position<RangeSlider aria-label="Logo horizontal position" max={1} min={-1} onChange={(event) => setX(Number(event.target.value))} step={.02} value={x} valueLabelDisplay="off" /></label>
      <label>Vertical position<RangeSlider aria-label="Logo vertical position" max={1} min={-1} onChange={(event) => setY(Number(event.target.value))} step={.02} value={y} valueLabelDisplay="off" /></label>
      <button className="button secondary compact" disabled={busy} onClick={() => { setRatio("original"); setZoom(1); setX(0); setY(0); }} type="button">Reset crop</button></>}
    {error && <p role="alert">{error}</p>}<footer><button className="button secondary" disabled={busy} onClick={onClose} type="button">Cancel</button><button className="button primary" disabled={busy || !dimensions.width || Boolean(error)} onClick={() => void apply()} type="button">Use logo</button></footer>
  </ShopDialog>;
}
