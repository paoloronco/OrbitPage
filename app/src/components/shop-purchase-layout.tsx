"use client";

import { ArrowLeft, Download, FileText, Mail } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { ShopPurchasePresentation } from "../../packages/shop/render.js";

export type { ShopPurchasePresentation };

export function ShopPurchaseLayout({ shop, className, children, basePath = "" }: {
  shop?: ShopPurchasePresentation; className: string; children: ReactNode; basePath?: string;
}) {
  const design = shop?.design;
  const style = design ? {
    "--purchase-bg": design.pageBackground, "--purchase-bg-end": design.pageBackgroundSecondary,
    "--purchase-ink": design.textColor, "--purchase-muted": design.mutedColor,
    "--purchase-accent": design.accentColor, "--purchase-button-ink": design.buttonTextColor,
    "--purchase-card": design.cardBackground, "--purchase-card-ink": design.cardTextColor,
    "--purchase-line": design.borderColor, "--purchase-radius": `${design.cardRadius}px`,
    "--purchase-font": design.fontFamily, "--purchase-opacity": `${Math.round((shop.cardEffect === "liquid-glass" ? Math.min(.72, shop.cardOpacity * .62) : shop.cardOpacity) * 100)}%`
  } as CSSProperties : undefined;
  return <main className={`shop-purchase-shell ${className} effect-${shop?.cardEffect || "solid"}`} style={style} lang="en-US" dir="ltr">
    <div className="shop-purchase-container">
      <header className="shop-purchase-nav">
        <div className="shop-purchase-brand">
          {shop ? shop.logoUrl ? <img alt="" src={shop.logoUrl} width={44} height={44} onError={event => { event.currentTarget.hidden = true; }} /> : <span aria-hidden="true">{shop.name.charAt(0)}</span>
            : <img alt="" src={`${basePath}/brand/orbitpage-mark.svg`} width={44} height={44} />}
          <strong>{shop?.name || "OrbitPage"}</strong>
        </div>
        {shop?.url && <a className="shop-purchase-back" href={shop.url}><ArrowLeft size={16} aria-hidden="true" /> Back to shop</a>}
      </header>
      {children}
      <footer className="shop-purchase-footer">
        <p>Keep your purchase email to return to your files and appointments.</p>
        {shop?.supportEmail && <a href={`mailto:${shop.supportEmail}`}><Mail size={16} aria-hidden="true" /> Contact the seller</a>}
      </footer>
    </div>
  </main>;
}

export function ShopPurchaseFiles({ files, remaining, expiresAt }: {
  files: Array<{ filename: string; sizeBytes: number; url: string }>;
  remaining: number; expiresAt?: string | null;
}) {
  const expired = Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());
  const available = remaining > 0 && !expired;
  return <div className="shop-purchase-files">
    {files.map((file, index) => <div className="shop-purchase-file" key={`${file.filename}-${index}`}>
      <span className="shop-purchase-file-icon" aria-hidden="true"><FileText size={22} /></span>
      <div><strong>{file.filename}</strong><small>{file.sizeBytes > 0 ? file.sizeBytes < 1024 * 1024 ? `${Math.ceil(file.sizeBytes / 1024)} KB` : `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : "Digital file"}</small></div>
      {available && <a className="shop-purchase-button primary" href={file.url} download={file.filename} aria-label={`Download ${file.filename}`}><Download size={17} aria-hidden="true" /> Download</a>}
    </div>)}
    <p className="shop-purchase-note">{available ? <>{remaining} downloads remaining{expiresAt && <> · Available until {new Date(expiresAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</>}</>
      : <>{expired ? "Your download link has expired." : "Download limit reached."} Contact the seller if you need another copy.</>}</p>
  </div>;
}
