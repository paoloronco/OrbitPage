"use client";

import { CalendarDays, CheckCircle2, ClipboardList, ExternalLink, PackageCheck, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { OrbitLoader as LoadingIndicator } from "./ui/orbit-loader";

type Question = { id: string; prompt: string; required: boolean };
type PortalOrder = {
  orderId: string;
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
};
type PortalData = {
  customer: { email: string; shopName: string };
  orders: PortalOrder[];
  bookings: Array<{ bookingId: string; orderId: string; productTitle: string; status: string; startAt: string | null; endAt: string | null; meetingUrl: string | null }>;
};

export default function ShopCustomerClient({ initialAccess, basePath = "" }: { initialAccess: string; basePath?: string }) {
  const [access, setAccess] = useState(initialAccess);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function load() {
    const response = await fetch(`${basePath}/api/shop/customer?access=${encodeURIComponent(access)}`, { cache: "no-store", referrerPolicy: "no-referrer" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "Customer area is unavailable.");
    setData(body as PortalData);
  }

  useEffect(() => {
    if (!access) {
      const stored = window.sessionStorage.getItem(`orbitpage-shop-customer-access:${basePath}`) || "";
      if (stored) {
        setAccess(stored);
        return;
      }
      setError("Use the private customer link received after your Shop purchase.");
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The questionnaire could not be saved.");
    } finally {
      setSaving("");
    }
  }

  if (error && !data) return <main className="shop-customer-shell"><section className="shop-customer-card"><ShieldCheck size={34} /><h1>Private customer area</h1><p>{error}</p></section></main>;
  if (!data) return <main className="shop-customer-shell"><section className="shop-customer-card"><LoadingIndicator size={32} /><h1>Opening your customer area</h1></section></main>;

  return <main className="shop-customer-shell">
    <header className="shop-customer-hero"><div><p className="dashboard-kicker">{data.customer.shopName}</p><h1>Your customer area</h1><p>{data.customer.email}</p></div><span><ShieldCheck size={18} /> Purchase-verified access</span></header>
    {error && <p className="shop-feedback error">{error}</p>}
    <section className="shop-customer-grid">
      {data.orders.map((order) => <article className="shop-customer-card" key={order.orderId}>
        <div className="shop-customer-card-heading"><PackageCheck size={22} /><div><h2>{order.productTitle}</h2><small>Order {order.orderId.slice(0, 8)}</small></div></div>
        {order.productType === "service" && <><div className="shop-customer-stats"><span><small>Booking</small><strong>{(order.bookingStatus || "awaiting booking").replaceAll("_", " ")}</strong></span><span><small>Sessions</small><strong>{order.sessionsRemaining}/{order.sessionsIncluded} available</strong></span></div>
        {order.bookingUrl && <a className="button primary" href={order.bookingUrl} rel="noreferrer" target="_blank"><CalendarDays size={17} /> Choose date and time</a>}
        {order.intakeQuestions.length > 0 && <form className="shop-intake-form" onSubmit={(event) => void submit(event, order)}><div><ClipboardList size={18} /><strong>Pre-consultation questionnaire</strong></div>{order.intakeQuestions.map((question) => <label key={question.id}><span>{question.prompt}{question.required ? " *" : ""}</span><textarea defaultValue={order.intakeAnswers.find((item) => item.questionId === question.id)?.answer || ""} maxLength={2000} onChange={(event) => setAnswers((current) => ({ ...current, [`${order.orderId}:${question.id}`]: event.target.value }))} required={question.required} rows={3} /></label>)}<button className="button secondary" disabled={saving === order.orderId} type="submit">{saving === order.orderId ? <LoadingIndicator size={16} /> : order.intakeSubmittedAt ? <CheckCircle2 size={16} /> : <ClipboardList size={16} />}{order.intakeSubmittedAt ? "Update answers" : "Send answers"}</button></form>}</>}
      </article>)}
    </section>
    {data.bookings.length > 0 && <section className="shop-customer-card shop-customer-bookings"><h2>Appointments</h2>{data.bookings.map((booking) => <article key={booking.bookingId}><CalendarDays size={18} /><div><strong>{booking.productTitle}</strong><span>{booking.startAt ? new Date(booking.startAt).toLocaleString() : booking.status.replaceAll("_", " ")}</span></div>{booking.meetingUrl && <a aria-label="Open meeting" href={booking.meetingUrl} rel="noreferrer" target="_blank"><ExternalLink size={17} /></a>}</article>)}</section>}
  </main>;
}
