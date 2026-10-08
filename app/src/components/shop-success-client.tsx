"use client";

import { CalendarDays, CheckCircle2, ClipboardList, Download, Hourglass, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { OrbitLoader as LoadingIndicator } from "./ui/orbit-loader";

type Delivery = {
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
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(cents / 100);
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
    async function check() {
      if (cancelled) return;
      attempts += 1;
      try {
        const endpoint = checkout
          ? `/api/shop/order?order=${encodeURIComponent(checkout.orderId)}&session_id=${encodeURIComponent(checkout.sessionId)}`
          : `/api/shop/delivery/${encodeURIComponent(initialDeliveryToken || "")}`;
        const response = await fetch(`${basePath}${endpoint}`, { cache: "no-store", referrerPolicy: "no-referrer" });
        const body = await response.json().catch(() => null);
        if (response.ok) {
          if (!cancelled) {
            const next = body as Delivery;
            setDelivery(next);
            setDeliveryToken(next.deliveryToken || initialDeliveryToken || "");
            setStatus("ready");
            if (checkout) window.history.replaceState({}, "", `${basePath}/shop/success`);
          }
          return;
        }
        if ((response.status === 409 || response.status === 404) && attempts < 20) {
          if (!cancelled) setStatus("waiting");
          retry = window.setTimeout(() => void check(), 1_500);
          return;
        }
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
    <main className="shop-success-shell">
      <section className="shop-success-card">
        <span className="shop-success-icon waiting">{status === "error" ? <Hourglass size={32} /> : <LoadingIndicator size={32} />}</span>
        <p className="dashboard-kicker">Order confirmation</p>
        <h1>{status === "error" ? "Your order is still processing" : "Preparing your order"}</h1>
        <p>Stripe is confirming the payment securely. Keep this page open while the order is prepared.</p>
        {status === "error" && <button className="button secondary" onClick={() => window.location.reload()} type="button">Check again</button>}
      </section>
    </main>
  );

  return (
    <main className="shop-success-shell">
      <section className="shop-success-card">
        <span className="shop-success-icon"><CheckCircle2 size={34} /></span>
        <p className="dashboard-kicker">Payment confirmed</p>
        <h1>Your order is ready</h1>
        <p className="shop-success-product">{delivery.productTitle} <strong>{money(delivery.amountTotal)}</strong></p>
        {delivery.downloadable ? (
          <><div className="shop-download-list">{(delivery.files?.length ? delivery.files : [{ filename: "Download file", sizeBytes: 0 }]).map((file, index) => <a className="button primary shop-download-action" href={`${basePath}/api/shop/download/${encodeURIComponent(deliveryToken)}?file=${index}`} key={`${file.filename}-${index}`}><Download size={17} /> {file.filename}</a>)}</div><small>{delivery.maxDownloads - delivery.downloadCount} downloads remaining · available until {new Date(delivery.expiresAt).toLocaleDateString()}</small></>
        ) : (
          <div className="shop-service-instructions">
            <strong>{delivery.bookingUrl ? "Book your appointment" : "Next steps"}</strong>
            {delivery.fulfillmentText && <p>{delivery.fulfillmentText}</p>}
            {delivery.bookingUrl ? (
              <a className="button primary shop-booking-action" href={delivery.bookingUrl} rel="noreferrer" target="_blank"><CalendarDays size={17} /> Choose date and time</a>
            ) : (
              !delivery.fulfillmentText && <p>The seller will contact you with the next steps.</p>
            )}
            {delivery.sessionsIncluded > 1 && <small>{delivery.sessionsRemaining} of {delivery.sessionsIncluded} sessions available in this package.</small>}
            {delivery.customerPortalUrl && <a className="button secondary shop-customer-action" href={delivery.customerPortalUrl}><ClipboardList size={17} /> {delivery.intakeQuestions.length ? "Complete questionnaire and manage booking" : "Open your customer area"}</a>}
          </div>
        )}
        <div className="shop-secure-note"><ShieldCheck size={17} /><span>Payment handled securely by Stripe. Order {delivery.orderId.slice(0, 8)}.</span></div>
      </section>
    </main>
  );
}
