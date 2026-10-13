import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import type { ShopRequest } from "./shop-client";
import type { ShopCoupon, ShopStripeOverview } from "../../packages/shop/stripe.js";
import { OrbitLoader } from "./ui/orbit-loader";
import { ShopDialog } from "./shop-editor-controls";

const money = (amount: number, currency = "eur") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);

export function ShopStripeAccount({ request, dashboardUrl }: { request: ShopRequest; dashboardUrl: string }) {
  const [data, setData] = useState<ShopStripeOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError("");
    try { const next = await request<ShopStripeOverview>("/api/shop/stripe/overview", { signal }); if (!signal?.aborted) setData(next); }
    catch (reason) { if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "Stripe account details could not be loaded."); }
    finally { if (!signal?.aborted) setBusy(false); }
  }, [request]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  return <section aria-label="Stripe account overview" className="shop-stripe-overview">
    <header className="shop-stripe-overview-heading"><div><h4>{data?.accountName || "Connected Stripe account"}</h4>{data && <small>{data.accountId} · {data.livemode ? "Live mode" : "Test mode"}</small>}</div><button aria-label="Refresh Stripe account" className="button secondary compact" disabled={busy} onClick={() => void load()} type="button">{busy ? <OrbitLoader size={16} /> : <RefreshCw size={16} />} Refresh</button></header>
    {error && <p className="shop-feedback error" role="alert">{error}</p>}
    {!data && busy && <p className="shop-provider-muted" role="status">Loading Stripe account…</p>}
    {data && <>
      <div className="shop-stripe-balances">{(["available", "pending"] as const).map(kind => <div key={kind}><span>{kind === "available" ? "Available balance" : "Pending balance"}</span>{data[kind].length ? data[kind].map(item => <strong key={item.currency}>{money(item.amount, item.currency)}</strong>) : <strong>{money(0)}</strong>}</div>)}</div>
      <div className="shop-section-heading"><h4>Recent Stripe activity</h4><a href={dashboardUrl} rel="noreferrer" target="_blank">View all in Stripe <ArrowUpRight size={14} /></a></div>
      <p className="shop-provider-muted">Up to 50 recent account transactions, including activity outside OrbitPage. Amounts and fees come directly from Stripe.</p>
      {data.transactions.length ? <div aria-label="Stripe transactions" className="shop-catalog-table-scroll" role="region" tabIndex={0}><table className="shop-catalog-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Fees</th><th>Net</th></tr></thead><tbody>{data.transactions.map(item => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleDateString("en-US")}</td><td>{item.type.replaceAll("_", " ")}</td><td>{money(item.amount, item.currency)}</td><td>{money(item.fee, item.currency)}</td><td>{money(item.net, item.currency)}</td></tr>)}</tbody></table></div> : <p className="shop-provider-muted">No Stripe transactions yet.</p>}
    </>}
  </section>;
}

export function ShopCoupons({ request, connected, onConnect, dashboardUrl, currency = "eur" }: { currency?: string; request: ShopRequest; connected: boolean; onConnect: () => void; dashboardUrl: string }) {
  const [data, setData] = useState<{ coupons: ShopCoupon[]; hasMore: boolean } | null>(null);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discount, setDiscount] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [pending, setPending] = useState<{ coupon: ShopCoupon; remove: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try { const next = await request<{ coupons: ShopCoupon[]; hasMore: boolean }>("/api/shop/coupons", { signal }); if (!signal?.aborted) setData(next); }
    catch (reason) { if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "Coupons could not be loaded."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [request]);
  useEffect(() => { if (!connected) return; const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [connected, load]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const coupon = await request<ShopCoupon>("/api/shop/coupons", { method: "POST", body: JSON.stringify({ code, discountType, ...(discountType === "amount" ? { currency } : {}), discount: discountType === "amount" ? Math.round(Number(discount) * 100) : Number(discount), ...(maxRedemptions ? { maxRedemptions: Number(maxRedemptions) } : {}), ...(expiresAt ? { expiresAt: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}) }) });
      setData(current => {
        const coupons = [coupon, ...(current?.coupons || []).filter(item => item.id !== coupon.id)];
        return { coupons: coupons.slice(0, 50), hasMore: Boolean(current?.hasMore || coupons.length > 50) };
      });
      setSuccess(`Coupon ${coupon.code} is ready for Checkout.`); setCode("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The coupon could not be created."); }
    finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!pending) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = await request<ShopCoupon | { id: string; deleted: true }>(`/api/shop/coupons/${pending.coupon.id}${pending.remove ? "" : "/revoke"}`, { method: pending.remove ? "DELETE" : "POST" });
      setData(current => current ? { ...current, coupons: "deleted" in result ? current.coupons.filter(coupon => coupon.id !== result.id) : current.coupons.map(coupon => coupon.id === result.id ? result : coupon) } : current);
      setSuccess(`Coupon ${pending.coupon.code} ${pending.remove ? "deleted" : "revoked"}.`);
      setPending(null);
    } catch (reason) {
      await load();
      setError(reason instanceof Error ? reason.message : "The coupon could not be updated.");
    } finally { setBusy(false); }
  }
  return <section aria-labelledby="shop-coupons-title" className="shop-provider-panel shop-coupons">
    <header className="shop-provider-heading"><h3 id="shop-coupons-title">Coupons</h3>{connected && <button className="button primary" disabled={busy || loading} form="shop-coupon-form" type="submit">{busy ? <OrbitLoader size={16} /> : <Plus size={16} />} Create coupon</button>}<p>Create discount codes for customers to enter at Stripe Checkout.</p></header>
    {!connected ? <><p className="shop-provider-muted">Connect Stripe before creating coupons.</p><button className="button primary" onClick={onConnect} type="button">Open Stripe settings</button></> : <>
      <form id="shop-coupon-form" className="shop-provider-form shop-coupon-form" onSubmit={event => void create(event)}><fieldset disabled={busy || loading}><div className="shop-option-grid">
        <label>Coupon code<input autoCapitalize="characters" autoComplete="off" maxLength={40} minLength={2} onChange={event => setCode(event.target.value)} pattern="[A-Za-z0-9-]+" placeholder="WELCOME10" required value={code} /></label>
        <label>Discount type<select onChange={event => setDiscountType(event.target.value as "percent" | "amount")} value={discountType}><option value="percent">Percentage</option><option value="amount">Fixed amount ({currency.toUpperCase()})</option></select></label>
        <label>{discountType === "percent" ? "Discount (%)" : `Discount (${currency.toUpperCase()})`}<input max={discountType === "percent" ? 100 : 10000} min="0.01" onChange={event => setDiscount(event.target.value)} required step="0.01" type="number" value={discount} /></label>
        <label>Maximum uses<input max="1000000" min="1" onChange={event => setMaxRedemptions(event.target.value)} placeholder="Unlimited" step="1" type="number" value={maxRedemptions} /></label>
        <label>Expires at<input onChange={event => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} /><small>Optional · your local time</small></label>
      </div><p className="shop-provider-muted">Leave limits empty for unlimited uses and no expiry. Limits are fixed when created; revoke and create a new code to change them.</p></fieldset></form>
      {loading && <p className="shop-provider-muted" role="status">Loading coupons…</p>}
      {data?.coupons.length ? <div aria-label="Coupon codes" className="shop-catalog-table-scroll" role="region" tabIndex={0}><table className="shop-catalog-table"><thead><tr><th>Code</th><th>Discount</th><th>Uses / limit</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.coupons.map(coupon => {
        const expired = Boolean(coupon.expiresAt && coupon.expiresAt * 1000 <= Date.now());
        const exhausted = Boolean(coupon.maxRedemptions && coupon.timesRedeemed >= coupon.maxRedemptions);
        return <tr key={coupon.id}><td><strong>{coupon.code}</strong></td><td>{coupon.discountType === "percent" ? `${coupon.discount}%` : money(coupon.discount, coupon.currency || "eur")}</td><td>{coupon.timesRedeemed} / {coupon.maxRedemptions ?? "Unlimited"}</td><td>{coupon.expiresAt ? new Date(coupon.expiresAt * 1000).toLocaleString() : "No expiry"}</td><td>{expired ? "Expired" : exhausted ? "Used up" : coupon.active ? "Active" : "Revoked"}</td><td>{coupon.manageable ? <div className="shop-coupon-actions"><button className="button secondary compact" disabled={busy || loading || !coupon.active || expired || exhausted} onClick={() => { setError(""); setPending({ coupon, remove: false }); }} type="button">Revoke</button><button className="button secondary compact" disabled={busy || loading} onClick={() => { setError(""); setPending({ coupon, remove: true }); }} type="button">Delete</button></div> : <a href={dashboardUrl} rel="noreferrer" target="_blank">Manage in Stripe</a>}</td></tr>;
      })}</tbody></table></div> : data && <p className="shop-provider-muted">No coupons yet. Create your first code above.</p>}
      {data?.hasMore && <p className="shop-provider-muted">Showing the latest 50 codes. <a href={dashboardUrl} rel="noreferrer" target="_blank">View all in Stripe</a></p>}
    </>}
    {pending && <ShopDialog title={`${pending.remove ? "Delete" : "Revoke"} coupon ${pending.coupon.code}`} busy={busy} onClose={() => setPending(null)}>
      <p>{pending.remove ? "Permanently delete this discount from Stripe and remove it from this list?" : "Stop new customers from redeeming this code?"} Existing orders keep their discounts.</p>
      {error && <p className="shop-feedback error" role="alert">{error}</p>}
      <div className="shop-coupon-actions"><button className="button secondary" disabled={busy} onClick={() => setPending(null)} type="button">Cancel</button><button className="button primary" disabled={busy} onClick={() => void confirmAction()} type="button">{pending.remove ? "Delete coupon" : "Revoke coupon"}</button></div>
    </ShopDialog>}
    {error && !pending && <p className="shop-feedback error" role="alert">{error}</p>}
    {success && <p className="shop-feedback success" role="status">{success}</p>}
  </section>;
}
