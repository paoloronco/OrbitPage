import { useEffect, useState } from "react";
export function usePreviewDeviceSlot(selector: string, enabled = true) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 600px)");
    let frame = 0;
    const update = () => setSlot(enabled ? document.querySelector<HTMLElement>(selector) : null);
    const resize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    query.addEventListener("change", resize);
    return () => { cancelAnimationFrame(frame); query.removeEventListener("change", resize); };
  }, [selector, enabled]);
  return slot;
}
