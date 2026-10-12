export function keepMobileInputVisible(input: HTMLTextAreaElement) {
  let frame = 0;
  const center = () => {
    if (document.activeElement !== input || !window.matchMedia('(max-width: 767px)').matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (document.activeElement !== input) return;
      const viewport = window.visualViewport;
      const rect = input.getBoundingClientRect();
      const height = viewport?.height ?? window.innerHeight;
      window.scrollBy({ top: rect.top - (viewport?.offsetTop ?? 0) - (height - rect.height) / 2, behavior: 'smooth' });
    });
  };
  input.addEventListener('focus', center);
  window.visualViewport?.addEventListener('resize', center);
  return () => {
    cancelAnimationFrame(frame);
    input.removeEventListener('focus', center);
    window.visualViewport?.removeEventListener('resize', center);
  };
}
