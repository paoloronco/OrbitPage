import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PreviewDevice } from './PreviewDeviceToggle';

export function ShopDeviceFrame({ device, publicUrl, children }: { device: PreviewDevice; publicUrl: string; children: ReactNode }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<{ device: PreviewDevice; width: number; height: number } | null>(null);
  const sourceWidth = device === 'desktop' ? 1280 : 390;
  const measured = viewport?.device === device ? viewport : null;
  const scale = measured ? measured.width / sourceWidth : 0;
  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return;
    const measure = () => setViewport({ device, width: screen.clientWidth, height: screen.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(screen);
    return () => observer.disconnect();
  }, [device]);
  return (
    <div className={`shop-device-frame ${device}`} data-preview-device={device}>
      <div className="shop-device-hardware">
        {device === 'desktop' ? <div aria-hidden="true" className="shop-device-browser"><span>● ● ●</span><small>{publicUrl.replace(/^https?:\/\//, '')}</small></div> : <span aria-hidden="true" className="shop-device-island" />}
        <div className="shop-device-screen" ref={screenRef}>
          <div className="shop-device-viewport" data-preview-source-width={sourceWidth} data-preview-viewport-ready={scale ? 'true' : 'false'} style={{ width: sourceWidth, height: scale && measured ? measured.height / scale : undefined, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
