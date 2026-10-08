"use client";

import { ArrowRight, CalendarDays, CheckCircle2, FileText, Hourglass } from "lucide-react";
import { useEffect, useState } from "react";
import { OrbitLoader as LoadingIndicator } from "./ui/orbit-loader";
import { ShopPurchaseFiles, ShopPurchaseLayout, type ShopPurchasePresentation } from "./shop-purchase-layout";

type Delivery = {
  shop?: ShopPurchasePresentation;
  paidAt?: string | null;
  orderId: string;
  productTitle: string;
  productType: "digital" | "service";
  amountTotal: number;
  currency: "eur";
  fulfillmentText: string;
  bookingUrl: string;
  downloadable: boolean;
  files: Array<{ filename: string; sizeBytes: number }>;
  downloadCount: number;
  maxDownloads: number;
  expiresAt: string;
  deliveryToken?: string;
  customerPortalUrl: string;
  sessionsIncluded: number;
  sessionsRemaining: number;
  intakeQuestions: Array<{ id: string; prompt: string; required: boolean }>;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(cents / 100);
}
export default function ShopSuccessClient({
  deliveryToken: initialDeliveryToken,
  checkout,
  basePath = ""
}: {
  basePath?: string;
  deliveryToken?: string;
  checkout?: { orderId: string; sessionId: string };
}) {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [deliveryToken, setDeliveryToken] = useState(initialDeliveryToken || "");
  const [status, setStatus] = useState<"checking" | "ready" | "waiting" | "error">("checking");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let retry: number | undefined;
    const storedToken = initialDeliveryToken || window.sessionStorage.getItem(`orbitpage-shop-delivery:${basePath}`) || "";
    if (!checkout && !storedToken) { setStatus("error"); return; }
    async function check() {
      if (cancelled) return;
      attempts += 1;
      try {
        const endpoint = checkout
          ? `/api/shop/order?order=${encodeURIComponent(checkout.orderId)}&session_id=${encodeURIComponent(checkout.sessionId)}`
          : `/api/shop/delivery/${encodeURIComponent(storedToken)}`;
        const response = await fetch(`${basePath}${endpoint}`, { cache: "no-store", referrerPolicy: "no-referrer" });
        const body = await response.json().catch(() => null);
        if (response.ok) {
          if (!cancelled) {
            const next = body as Delivery;
            setDelivery(next);
            const token = next.deliveryToken || storedToken;
            setDeliveryToken(token);
            if (token) window.sessionStorage.setItem(`orbitpage-shop-delivery:${basePath}`, token);
            setStatus("ready");
            if (checkout) window.history.replaceState({}, "", `${basePath}/shop/success`);
          }
          return;
        }
        if (checkout && response.status === 409) {
          if (!cancelled) setStatus("waiting");
          if (attempts < 20) retry = window.setTimeout(() => void check(), 1_500);
          return;
        }
        if (response.status >= 500 && attempts < 20) { retry = window.setTimeout(() => void check(), 1_500); return; }
        if (!cancelled) setStatus("error");
      } catch {
        if (!cancelled && attempts < 20) retry = window.setTimeout(() => void check(), 1_500);
        else if (!cancelled) setStatus("error");
      }
    }
    void check();
    return () => { cancelled = true; window.clearTimeout(retry); };
  }, [checkout, initialDeliveryToken, basePath]);

  if (status !== "ready" || !delivery) return (
    <ShopPurchaseLayout className="shop-success-shell" basePath={basePath}>
      <section className="shop-purchase-state" aria-live="polite">
        <span className="shop-purchase-state-icon">{status === "error" ? <Hourglass size={28} /> : <LoadingIndicator size={28} />}</span>
        <h1>{status === "error" ? checkout ? "We couldn’t confirm your payment yet" : "This purchase link is unavailable" : status === "waiting" ? "Waiting for payment confirmation" : "Checking your payment"}</h1>
        <p>{status === "checking" ? "Your purchase will appear as soon as Stripe confirms the payment." : status === "waiting" ? "Your payment is still pending. Your files or booking will become available once it completes." : "Try again, or open the download link in your purchase email. Contact the seller if you need help."}</p>
        {(status === "error" || status === "waiting") && <button className="shop-purchase-button secondary" onClick={() => window.location.reload()} type="button">Check again</button>}
      </section>
    </ShopPurchaseLayout>
  );

  return (
    <ShopPurchaseLayout shop={delivery.shop} className="shop-success-shell" basePath={basePath}>
      <header className="shop-purchase-hero">
        <p className="shop-purchase-confirmed"><CheckCircle2 size={18} aria-hidden="true" /> Payment confirmed</p>
        <h1>Your order is ready</h1><p>{delivery.downloadable ? "Your files are ready to download." : "Book an appointment and view your service details."}</p>
      </header>
      <div className="shop-purchase-columns">
        <section className="shop-purchase-card shop-success-card">
          <div className="shop-customer-card-heading"><span className="shop-purchase-product-icon" aria-hidden="true">{delivery.downloadable ? <FileText size={24} /> : <CalendarDays size={24} />}</span><div><p className="shop-purchase-kind">{delivery.downloadable ? "Digital download" : "Service"}</p><h2>{delivery.productTitle}</h2></div></div>
          {delivery.downloadable ? <ShopPurchaseFiles files={(delivery.files?.length ? delivery.files : [{ filename: "file", sizeBytes: 0 }]).map((file, index) => ({ ...file, url: `${basePath}/api/shop/download/${encodeURIComponent(deliveryToken)}?file=${index}` }))} remaining={Math.max(0, delivery.maxDownloads - delivery.downloadCount)} expiresAt={delivery.expiresAt} /> : (
          <div className="shop-service-instructions">
            <h3>{delivery.bookingUrl ? "Choose your appointment" : "Next steps"}</h3>
            {delivery.fulfillmentText && <p>{delivery.fulfillmentText}</p>}
            {delivery.bookingUrl && delivery.sessionsRemaining > 0 ? (
              <a className="shop-purchase-button primary shop-booking-action" href={delivery.bookingUrl} rel="noreferrer" target="_blank"><CalendarDays size={17} aria-hidden="true" /> Choose date and time</a>
            ) : (
              !delivery.fulfillmentText && <p>The seller will contact you with the next steps.</p>
            )}
            {delivery.sessionsIncluded > 0 && <p className="shop-purchase-note">{delivery.sessionsRemaining} of {delivery.sessionsIncluded} sessions available.</p>}
          </div>
        )}
        </section>
        <aside className="shop-purchase-sidebar">
          <section className="shop-purchase-card"><h2>Order details</h2><dl className="shop-purchase-details shop-success-product"><div><dt>Order</dt><dd>{delivery.orderId.slice(0, 8)}</dd></div>{delivery.paidAt && <div><dt>Date</dt><dd>{new Date(delivery.paidAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</dd></div>}<div className="shop-purchase-total"><dt>Total paid</dt><dd>{money(delivery.amountTotal)}</dd></div></dl><p className="shop-purchase-note">Payment processed by Stripe.</p></section>
          {delivery.customerPortalUrl && <section className="shop-purchase-card shop-purchase-access"><h2>Your purchases</h2><p>Find your files, appointments and service details here.</p><a className="shop-purchase-button secondary" href={delivery.customerPortalUrl}>View your purchases <ArrowRight size={17} aria-hidden="true" /></a>{delivery.intakeQuestions.length > 0 && <p className="shop-purchase-note">Your service includes a questionnaire. Complete it before your appointment.</p>}</section>}
        </aside>
      </div>
    </ShopPurchaseLayout>
  );
}
