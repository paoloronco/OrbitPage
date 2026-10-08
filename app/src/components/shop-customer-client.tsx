"use client";

import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, Download, ExternalLink, FileText, Mail } from "lucide-react";
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
  fulfillmentText: string;
  files: Array<{ filename: string; sizeBytes: number; url: string }>;
  deliveryUrl: string;
  downloadsRemaining: number;
  expiresAt: string | null;
};
type PortalData = {
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

  async function load() {
    const response = await fetch(`${basePath}/api/shop/customer?access=${encodeURIComponent(access)}`, { cache: "no-store", referrerPolicy: "no-referrer" });
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

  if (error && !data) return <main className="shop-customer-shell" lang="en-US" dir="ltr"><section className="shop-customer-card"><Mail size={28} /><h1>Your purchases</h1><p>{error}</p></section></main>;
  if (!data) return <main className="shop-customer-shell" lang="en-US" dir="ltr"><section className="shop-customer-card"><LoadingIndicator size={28} /><h1>Loading your purchases</h1></section></main>;

  return <main className="shop-customer-shell" lang="en-US" dir="ltr">
    <header className="shop-customer-hero"><div>{data.customer.shopUrl && <a className="shop-customer-back" href={data.customer.shopUrl}><ArrowLeft size={16} /> {data.customer.shopName}</a>}<h1>Your purchases</h1><p>Download your files and manage your appointments.</p></div><p className="shop-customer-email">{data.customer.email}</p></header>
    {error && <p className="shop-feedback error">{error}</p>}
    <section className="shop-customer-grid">
      {data.orders.map((order) => <article className="shop-customer-card" key={order.orderId}>
        <div className="shop-customer-card-heading"><span className="shop-customer-product-icon">{order.productType === "digital" ? <FileText size={22} /> : <CalendarDays size={22} />}</span><div><h2>{order.productTitle}</h2><small>{order.paidAt && <>{new Date(order.paidAt).toLocaleDateString("en-US", { dateStyle: "medium" })} · </>}Order {order.orderId.slice(0, 8)}</small></div></div>
        {order.productType === "digital" && <div className="shop-customer-files">
          {order.downloadsRemaining > 0 && (!order.expiresAt || Date.parse(order.expiresAt) > Date.now()) ? <>
            {(order.files || []).map((file, index) => <div className="shop-customer-file" key={`${file.filename}-${index}`}><div><strong>{file.filename}</strong><small>{file.sizeBytes < 1024 * 1024 ? `${Math.ceil(file.sizeBytes / 1024)} KB` : `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}</small></div><a className="button primary" href={file.url} download={file.filename} aria-label={`Download ${file.filename}`}><Download size={17} /> Download</a></div>)}
            {!order.files?.length && order.deliveryUrl && <a className="button primary" href={order.deliveryUrl}><Download size={17} /> Open downloads</a>}
            <p className="shop-customer-download-note">{order.downloadsRemaining} downloads remaining{order.expiresAt && <> · Available until {new Date(order.expiresAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</>}</p>
          </> : <p className="shop-customer-download-note">{order.downloadsRemaining === 0 ? "Download limit reached." : "Your download link has expired."} Contact the seller if you need another copy.</p>}
        </div>}
        {order.productType === "service" && <><div className="shop-customer-stats"><span><small>Appointment</small><strong>{({ awaiting_booking: "Choose a time", scheduled: "Booked", rescheduled: "Rescheduled", cancelled: "Cancelled", completed: "Completed", no_show: "Missed appointment" } as Record<string, string>)[order.bookingStatus || "awaiting_booking"] || "Choose a time"}</strong></span><span><small>Sessions remaining</small><strong>{order.sessionsRemaining} of {order.sessionsIncluded}</strong></span></div>
        {order.fulfillmentText && <p className="shop-service-copy">{order.fulfillmentText}</p>}
        {order.bookingUrl && order.sessionsRemaining > 0 && <a className="button primary" href={order.bookingUrl} rel="noreferrer" target="_blank"><CalendarDays size={17} /> Book an appointment</a>}
        {order.intakeQuestions.length > 0 && <form className="shop-intake-form" onSubmit={(event) => void submit(event, order)}><div><ClipboardList size={18} /><strong>Pre-consultation questionnaire</strong></div>{order.intakeQuestions.map((question) => <label key={question.id}><span>{question.prompt}{question.required ? " *" : ""}</span><textarea defaultValue={order.intakeAnswers.find((item) => item.questionId === question.id)?.answer || ""} maxLength={2000} onChange={(event) => setAnswers((current) => ({ ...current, [`${order.orderId}:${question.id}`]: event.target.value }))} required={question.required} rows={3} /></label>)}<button className="button secondary" disabled={saving === order.orderId} type="submit">{saving === order.orderId ? <LoadingIndicator size={16} /> : order.intakeSubmittedAt ? <CheckCircle2 size={16} /> : <ClipboardList size={16} />}{order.intakeSubmittedAt ? "Update answers" : "Send answers"}</button></form>}</>}
      </article>)}
    </section>
    {data.orders.length === 0 && <section className="shop-customer-card"><h2>No purchases available</h2><p>Open the link from your most recent purchase email.</p></section>}
    {data.bookings.length > 0 && <section className="shop-customer-card shop-customer-bookings"><h2>Appointments</h2>{data.bookings.map((booking) => <article key={booking.bookingId}><CalendarDays size={18} /><div><strong>{booking.productTitle}</strong><span>{booking.startAt ? new Date(booking.startAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : booking.status.replaceAll("_", " ")}</span></div>{booking.meetingUrl && <a aria-label="Open meeting" href={booking.meetingUrl} rel="noreferrer" target="_blank"><ExternalLink size={17} /></a>}</article>)}</section>}
    <footer className="shop-customer-footer"><p>Keep your personal purchase link to return here. No account or password needed.</p>{data.customer.supportEmail && <a href={`mailto:${data.customer.supportEmail}`}>Contact the seller</a>}</footer>
  </main>;
}
