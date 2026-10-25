import { useEffect, type RefObject } from "react";

export function useAiConversationScroll(ref: RefObject<HTMLDivElement | null>, updates: unknown, open = true) {
  useEffect(() => {
    const workspace = ref.current?.closest<HTMLElement>(".oss-ai-workspace");
    if (!workspace || !open) return;
    const fit = () => {
      if (!workspace.getClientRects().length) return;
      const top = Math.max(0, workspace.getBoundingClientRect().top + window.scrollY);
      workspace.style.setProperty("--ai-workspace-top", `${top}px`);
    };
    const frame = requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    if (workspace.parentElement) observer.observe(workspace.parentElement);
    window.addEventListener("resize", fit);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", fit); };
  }, [ref, open]);

  useEffect(() => {
    const container = ref.current;
    if (!container || !open) return;
    let follow = true;
    const scroll = () => { if (follow) container.scrollTop = container.scrollHeight; };
    const frame = requestAnimationFrame(scroll);
    const onScroll = () => { follow = container.scrollHeight - container.scrollTop - container.clientHeight < 48; };
    // Preview assets mount after the response; keep following until the user scrolls away.
    const observer = new ResizeObserver(scroll);
    observer.observe(container);
    for (const child of container.children) observer.observe(child);
    for (const proposal of container.querySelectorAll(".oss-ai-proposal, .ai-page-agent-proposal")) observer.observe(proposal);
    container.addEventListener("scroll", onScroll);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); container.removeEventListener("scroll", onScroll); };
  }, [ref, updates, open]);
}
