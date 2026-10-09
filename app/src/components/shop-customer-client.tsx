"use client";

import { shopOrderLabel } from "../../packages/shop/orders.js";

import { CalendarDays, CheckCircle2, ChevronDown, ClipboardList, ExternalLink, FileText, Mail } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { OrbitLoader as LoadingIndicator } from "./ui/orbit-loader";
import { ShopPurchaseFiles, ShopPurchaseLayout, type ShopPurchasePresentation } from "./shop-purchase-layout";

type Question = { id: string; prompt: string; required: boolean };
type PortalOrder = {
  orderId: string;
  orderNumber?: number;
  productTitle: string;
  productType: "digital" | "service";
  paidAt: string | null;
  bookingUrl: string;
  bookingStatus: string | null;
  sessionsIncluded: number;
  sessionsRemaining: number;
  intakeQuestions: Question[];
  intakeAnswers: Array<{ questionId: string; answer: string }>;
  intakeSubmittedAt: string | null;
  fulfillmentText: string;
  files: Array<{ filename: string; sizeBytes: number; url: string }>;
  deliveryUrl: string;
  downloadsRemaining: number;
  expiresAt: string | null;
};
type PortalData = {
  shop?: ShopPurchasePresentation;
  customer: { email: string; shopName: string; shopUrl: string; supportEmail: string };
  orders: PortalOrder[];
  bookings: Array<{ bookingId: string; orderId: string; productTitle: string; status: string; startAt: string | null; endAt: string | null; meetingUrl: string | null }>;
};

export default function ShopCustomerClient({ initialAccess, basePath = "" }: { initialAccess: string; basePath?: string }) {
  const [access, setAccess] = useState(initialAccess);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedOrder, setSavedOrder] = useState("");

  async function load() {
    const response = await fetch(`${basePath}/api/shop/customer`, { headers: { "x-shop-customer-access": access }, cache: "no-store", referrerPolicy: "no-referrer" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error?.includes("expired") ? "This link has expired. Open the download link in your purchase email, or contact the seller." : body?.error || "Your purchases are unavailable.");
    setData(body as PortalData);
  }

  useEffect(() => {
    if (!access) {
      const stored = window.sessionStorage.getItem(`orbitpage-shop-customer-access:${basePath}`) || "";
      if (stored) {
        setAccess(stored);
        return;
      }
      setError("Open the personal link in your purchase email. You don’t need an account or password.");
      return;
    }
    void load().then(() => {
      window.sessionStorage.setItem(`orbitpage-shop-customer-access:${basePath}`, access);
      window.history.replaceState({}, "", `${basePath}/shop/customer`);
    }).catch((reason) => {
      window.sessionStorage.removeItem(`orbitpage-shop-customer-access:${basePath}`);
      setError(reason instanceof Error ? reason.message : "Customer area is unavailable.");
    });
    // The capability stays in component memory; it is removed from browser history after validation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, basePath]);

  async function submit(event: FormEvent, order: PortalOrder) {
    event.preventDefault();
    setSaving(order.orderId);
    setSavedOrder("");
    setError("");
    try {
      const response = await fetch(`${basePath}/api/shop/customer`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-shop-customer-access": access },
        body: JSON.stringify({ orderId: order.orderId, answers: order.intakeQuestions.map((question) => ({ questionId: question.id, answer: answers[`${order.orderId}:${question.id}`] ?? order.intakeAnswers.find((item) => item.questionId === question.id)?.answer ?? "" })) }),
        referrerPolicy: "no-referrer"
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "The questionnaire could not be saved.");
      await load();
      setSavedOrder(order.orderId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The questionnaire could not be saved.");
    } finally {
      setSaving("");
    }
  }

  if (!data) return <ShopPurchaseLayout className="shop-customer-shell" basePath={basePath}><section className="shop-purchase-state" aria-live="polite"><span className="shop-purchase-state-icon">{error ? <Mail size={28} aria-hidden="true" /> : <LoadingIndicator size={28} />}</span><h1>{error ? "Your purchases" : "Loading your purchases"}</h1>{error && <p>{error}</p>}</section></ShopPurchaseLayout>;

  return <ShopPurchaseLayout shop={data.shop} className="shop-customer-shell" basePath={basePath}>
    <header className="shop-purchase-hero shop-customer-hero"><div><h1>Your purchases</h1><p>Download your files or book your next appointment.</p></div><p className="shop-customer-email"><Mail size={16} aria-hidden="true" /> {data.customer.email}</p></header>
    {error && <p className="shop-purchase-feedback" role="alert">{error}</p>}
    <div className={`shop-purchase-columns${data.bookings.length ? "" : " single-column"}`}>
    <section className="shop-customer-grid" aria-label="Purchases">
      {data.orders.map((order) => <article className="shop-purchase-card shop-customer-card" key={order.orderId}>
        <div className="shop-customer-card-heading"><span className="shop-purchase-product-icon" aria-hidden="true">{order.productType === "digital" ? <FileText size={24} /> : <CalendarDays size={24} />}</span><div><p className="shop-purchase-kind">{order.productType === "digital" ? "Digital download" : "Service"}</p><h2>{order.productTitle}</h2><small>{order.paidAt && <>{new Date(order.paidAt).toLocaleDateString("en-US", { dateStyle: "medium" })} · </>}Order {shopOrderLabel(order)}</small></div></div>
        {order.productType === "digital" && <div className="shop-customer-files">
          <ShopPurchaseFiles files={order.files || []} remaining={order.downloadsRemaining} expiresAt={order.expiresAt} />
          {!order.files?.length && order.deliveryUrl && order.downloadsRemaining > 0 && (!order.expiresAt || Date.parse(order.expiresAt) > Date.now()) && <a className="shop-purchase-button primary" href={order.deliveryUrl}>Open downloads</a>}
        </div>}
        {order.productType === "service" && <><div className="shop-customer-stats"><div><span>Appointment</span><strong>{({ awaiting_booking: "Choose a time", scheduled: "Booked", rescheduled: "Rescheduled", cancelled: "Cancelled", completed: "Completed", no_show: "Missed appointment" } as Record<string, string>)[order.bookingStatus || "awaiting_booking"] || "Choose a time"}</strong></div><div><span>Sessions remaining</span><strong>{order.sessionsRemaining} <small>of {order.sessionsIncluded}</small></strong></div></div>
        {order.fulfillmentText && <p className="shop-service-copy">{order.fulfillmentText}</p>}
        {order.bookingUrl && order.sessionsRemaining > 0 && <a className="shop-purchase-button primary" href={order.bookingUrl} rel="noreferrer" target="_blank"><CalendarDays size={17} aria-hidden="true" /> Book an appointment</a>}
        {order.intakeQuestions.length > 0 && <details className="shop-intake-details" open={!order.intakeSubmittedAt}><summary><ClipboardList size={18} aria-hidden="true" /><span>Before your appointment</span><ChevronDown size={17} aria-hidden="true" /></summary><form className="shop-intake-form" onSubmit={(event) => void submit(event, order)}><p>Share these details with the seller before you meet.</p>{order.intakeQuestions.map((question) => <label key={question.id}><span>{question.prompt}{question.required ? " *" : ""}</span><textarea value={answers[`${order.orderId}:${question.id}`] ?? order.intakeAnswers.find((item) => item.questionId === question.id)?.answer ?? ""} maxLength={2000} onChange={(event) => setAnswers((current) => ({ ...current, [`${order.orderId}:${question.id}`]: event.target.value }))} required={question.required} rows={3} /></label>)}<button className="shop-purchase-button secondary" disabled={Boolean(saving)} type="submit">{saving === order.orderId ? <><LoadingIndicator size={16} /> Saving answers…</> : order.intakeSubmittedAt ? "Update answers" : "Send answers"}</button></form></details>}
        {savedOrder === order.orderId && <p className="shop-purchase-saved" role="status"><CheckCircle2 size={17} aria-hidden="true" /> Your answers have been saved.</p>}</>}
      </article>)}
      {data.orders.length === 0 && <section className="shop-purchase-card shop-purchase-empty"><FileText size={30} aria-hidden="true" /><h2>No purchases available</h2><p>Open the link from your most recent purchase email, or contact the seller for help.</p></section>}
    </section>
    {data.bookings.length > 0 && <aside className="shop-purchase-sidebar"><section className="shop-purchase-card shop-customer-bookings"><h2>Your appointments</h2>{data.bookings.map((booking) => <article key={booking.bookingId}><span className="shop-purchase-appointment-icon" aria-hidden="true"><CalendarDays size={20} /></span><div><h3>{booking.productTitle}</h3><p>{booking.startAt ? new Date(booking.startAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "Time to be confirmed"}</p><small>{({ scheduled: "Booked", rescheduled: "Rescheduled", cancelled: "Cancelled", completed: "Completed", no_show: "Missed appointment" } as Record<string, string>)[booking.status] || "Awaiting confirmation"}</small>{booking.meetingUrl && ["scheduled", "rescheduled"].includes(booking.status) && <a className="shop-purchase-meeting" href={booking.meetingUrl} rel="noreferrer" target="_blank">Join meeting <ExternalLink size={15} aria-hidden="true" /></a>}</div></article>)}</section></aside>}
    </div>
  </ShopPurchaseLayout>;
}
