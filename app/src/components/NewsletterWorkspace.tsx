"use client";

import { FormEvent, type InputHTMLAttributes, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  Copy,
  Eye,
  Link2,
  LoaderCircle,
  Mail,
  MousePointerClick,
  Plus,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { newsletterRequest } from "@/lib/api-client";
import {
  canDeleteNewsletterCampaign,
  type NewsletterCampaign,
  type NewsletterCampaignContent,
  type NewsletterDashboardData,
} from "@/lib/newsletter-types";
import ColorPicker from "@/components/ui/color-picker";
import { useDialogAccessibility } from "@/lib/use-dialog-accessibility";
import "./newsletter-workspace.css";

type NewsletterUser = { uid: string; email?: string };
const LoadingIndicator = ({ size }: { size: number }) => <LoaderCircle aria-hidden="true" className="animate-spin" size={size} />;
function RangeSlider({ value, valueLabel, ...props }: InputHTMLAttributes<HTMLInputElement> & { value: number; valueLabel: string }) {
  return <span className="newsletter-native-range"><input {...props} type="range" value={value} /><span aria-hidden="true">{valueLabel}</span></span>;
}

type NewsletterView = "overview" | "campaigns" | "subscribers" | "smtp";
type CampaignDraft = {
  campaignId?: string;
  name: string;
  subject: string;
  preheader: string;
  content: NewsletterCampaignContent;
};

const EMPTY_CAMPAIGN: CampaignDraft = {
  name: "",
  subject: "",
  preheader: "",
  content: {
    eyebrow: "Latest update",
    headline: "Something worth sharing",
    body: "Write a useful update for your audience. Keep it focused, clear and easy to act on.",
    ctaLabel: "Discover more",
    ctaUrl: "",
    imageUrl: "",
    imageAlt: "",
    logoUrl: "",
    accentColor: "#2563eb",
    backgroundColor: "#eef2ff",
    contentBackgroundColor: "#ffffff",
    contentColor: "#111827",
    buttonTextColor: "#ffffff",
    fontFamily: "system",
    textAlign: "left",
    containerWidth: 640,
    cornerRadius: 8,
    buttonRadius: 6,
    footerNote: "You receive this email because you subscribed to our updates.",
  },
};

async function newsletterFetch<T>(
  _user: NewsletterUser,
  input: string,
  init?: RequestInit,
) {
  return newsletterRequest<T>(input, init);
}

function templateCampaign(
  kind: "restaurant" | "venue" | "general",
  sender: string,
): CampaignDraft {
  if (kind === "restaurant")
    return {
      ...EMPTY_CAMPAIGN,
      name: "New menu",
      subject: `A new menu from ${sender || "us"}`,
      preheader: "Seasonal dishes, familiar favourites and something new.",
      content: {
        ...EMPTY_CAMPAIGN.content,
        eyebrow: "From the kitchen",
        headline: "The new menu is ready",
        body: "We have refreshed the menu with new seasonal ingredients and a few dishes we have been waiting to share. Take a first look, then reserve your table.",
        ctaLabel: "View the menu",
        accentColor: "#b42318",
        backgroundColor: "#fff4ed",
        contentColor: "#3b1d16",
      },
    };
  if (kind === "venue")
    return {
      ...EMPTY_CAMPAIGN,
      name: "Weekly events",
      subject: `This week at ${sender || "the venue"}`,
      preheader: "New dates, guests and the details you need for the weekend.",
      content: {
        ...EMPTY_CAMPAIGN.content,
        eyebrow: "This week",
        headline: "Three nights. Three different sounds.",
        body: "The new programme is live. Discover this week's guests, set times and reservation details before the dates fill up.",
        ctaLabel: "See the events",
        accentColor: "#7c3aed",
        backgroundColor: "#f3e8ff",
        contentColor: "#20123a",
      },
    };
  return {
    ...EMPTY_CAMPAIGN,
    name: "Monthly update",
    subject: `News from ${sender || "our team"}`,
    preheader: "A concise update with what is new and what comes next.",
    content: { ...EMPTY_CAMPAIGN.content },
  };
}

function campaignFromSaved(campaign: NewsletterCampaign): CampaignDraft {
  return {
    campaignId: campaign.campaignId,
    name: campaign.name,
    subject: campaign.subject,
    preheader: campaign.preheader,
    content: { ...EMPTY_CAMPAIGN.content, ...campaign.content },
  };
}

const DESIGN_PRESETS: Array<{
  name: string;
  values: Partial<NewsletterCampaignContent>;
}> = [
  {
    name: "Clean",
    values: {
      fontFamily: "system",
      textAlign: "left",
      containerWidth: 640,
      cornerRadius: 8,
      buttonRadius: 6,
      backgroundColor: "#eef2ff",
      contentBackgroundColor: "#ffffff",
      contentColor: "#111827",
      accentColor: "#2563eb",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Editorial",
    values: {
      fontFamily: "editorial",
      textAlign: "left",
      containerWidth: 640,
      cornerRadius: 0,
      buttonRadius: 0,
      backgroundColor: "#f2efe9",
      contentBackgroundColor: "#fffdf8",
      contentColor: "#27221d",
      accentColor: "#8a3b2b",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Centered",
    values: {
      fontFamily: "modern",
      textAlign: "center",
      containerWidth: 520,
      cornerRadius: 18,
      buttonRadius: 28,
      backgroundColor: "#e9f4f2",
      contentBackgroundColor: "#ffffff",
      contentColor: "#102b2a",
      accentColor: "#147d74",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Contrast",
    values: {
      fontFamily: "modern",
      textAlign: "left",
      containerWidth: 720,
      cornerRadius: 12,
      buttonRadius: 6,
      backgroundColor: "#111827",
      contentBackgroundColor: "#182235",
      contentColor: "#f8fafc",
      accentColor: "#f4c95d",
      buttonTextColor: "#111827",
    },
  },
];

function campaignFontStack(font: NewsletterCampaignContent["fontFamily"]) {
  return font === "editorial"
    ? "Georgia, 'Times New Roman', serif"
    : font === "modern"
      ? "'Trebuchet MS', Arial, sans-serif"
      : "Arial, Helvetica, sans-serif";
}

function percent(value: number, total: number) {
  return total > 0 ? `${Math.round((value / total) * 1000) / 10}%` : "0%";
}

function minimumLocalScheduleValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export default function NewsletterWorkspace({ user }: { user: NewsletterUser }) {
  const [data, setData] = useState<NewsletterDashboardData | null>(null);
  const [view, setView] = useState<NewsletterView>("overview");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [smtp, setSmtp] = useState({
    host: "",
    port: 587,
    username: "",
    password: "",
    fromName: "",
    fromEmail: "",
    replyTo: "",
  });
  const [subscriber, setSubscriber] = useState({
    email: "",
    name: "",
    consentConfirmed: false,
  });
  const [campaign, setCampaign] = useState<CampaignDraft>({
    ...EMPTY_CAMPAIGN,
    content: { ...EMPTY_CAMPAIGN.content },
  });
  const [scheduledFor, setScheduledFor] = useState("");
  const [campaignToDelete, setCampaignToDelete] =
    useState<NewsletterCampaign | null>(null);
  const deleteDialogRef = useDialogAccessibility<HTMLDivElement>(Boolean(campaignToDelete), () => { if (action === null) setCampaignToDelete(null); });

  async function load(showLoader = false) {
    if (showLoader) setLoading(true);
    try {
      const result = await newsletterFetch<NewsletterDashboardData>(
        user,
        "/api/newsletter",
        { method: "GET" },
      );
      setData(result);
      setSmtp({
        host: result.settings.host,
        port: result.settings.port,
        username: result.settings.username,
        password: "",
        fromName: result.settings.fromName,
        fromEmail: result.settings.fromEmail,
        replyTo: result.settings.replyTo || "",
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Newsletter data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
  }, [user.uid]);

  async function run<T>(name: string, task: () => Promise<T>, success: string) {
    setAction(name);
    setError("");
    setMessage("");
    try {
      const result = await task();
      setMessage(success);
      await load();
      return result;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The action failed.",
      );
      return null;
    } finally {
      setAction(null);
    }
  }

  async function saveSmtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(
      "smtp-save",
      () =>
        newsletterFetch(user, "/api/newsletter/settings", {
          method: "PUT",
          body: JSON.stringify(smtp),
        }),
      "SMTP settings saved. Verify the connection before sending.",
    );
  }

  async function testSmtp() {
    await run(
      "smtp-test",
      () =>
        newsletterFetch(user, "/api/newsletter/settings/test", {
          method: "POST",
          body: JSON.stringify({ recipient: smtp.fromEmail }),
        }),
      `Connection verified. A test message was sent to ${smtp.fromEmail}.`,
    );
  }

  async function addSubscriber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await run(
      "subscriber-add",
      () =>
        newsletterFetch(user, "/api/newsletter/subscribers", {
          method: "POST",
          body: JSON.stringify({ ...subscriber, source: "manual" }),
        }),
      "Subscriber added.",
    );
    if (result) setSubscriber({ email: "", name: "", consentConfirmed: false });
  }

  async function removeSubscriber(id: string) {
    if (!window.confirm("Remove this subscriber from the newsletter list?"))
      return;
    await run(
      `subscriber-remove:${id}`,
      () =>
        newsletterFetch(
          user,
          `/api/newsletter/subscribers/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        ),
      "Subscriber removed.",
    );
  }

  async function saveCampaign(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    return run(
      "campaign-save",
      () =>
        newsletterFetch<NewsletterCampaign>(user, "/api/newsletter/campaigns", {
          method: "POST",
          body: JSON.stringify(campaign),
        }),
      "Campaign draft saved.",
    );
  }

  async function queueCampaign(mode: "now" | "schedule") {
    const saved = await saveCampaign();
    if (!saved) return;
    const id = saved.campaignId;
    setCampaign(campaignFromSaved(saved));
    const date =
      mode === "schedule" && scheduledFor
        ? new Date(scheduledFor).toISOString()
        : null;
    const queued = await run(
      `campaign-${mode}`,
      () =>
        newsletterFetch(
          user,
          `/api/newsletter/campaigns/${encodeURIComponent(id)}/send`,
          {
            method: "POST",
            body: JSON.stringify({ scheduledFor: date }),
          },
        ),
      mode === "now" ? "Campaign queued for sending." : "Campaign scheduled.",
    );
    if (!queued) return;
    setCampaign({ ...EMPTY_CAMPAIGN, content: { ...EMPTY_CAMPAIGN.content } });
    setScheduledFor("");
  }

  async function cancelCampaign(id: string) {
    await run(
      `campaign-cancel:${id}`,
      () =>
        newsletterFetch(
          user,
          `/api/newsletter/campaigns/${encodeURIComponent(id)}/send`,
          { method: "DELETE" },
        ),
      "Scheduled campaign canceled.",
    );
  }

  async function deleteCampaign() {
    if (!campaignToDelete) return;
    const deleted = await run(
      `campaign-delete:${campaignToDelete.campaignId}`,
      () =>
        newsletterFetch(
          user,
          `/api/newsletter/campaigns/${encodeURIComponent(campaignToDelete.campaignId)}`,
          { method: "DELETE" },
        ),
      "Campaign and delivery data deleted.",
    );
    if (!deleted) return;
    if (campaign.campaignId === campaignToDelete.campaignId)
      setCampaign({
        ...EMPTY_CAMPAIGN,
        content: { ...EMPTY_CAMPAIGN.content },
      });
    setCampaignToDelete(null);
  }

  function updateCampaignContent(values: Partial<NewsletterCampaignContent>) {
    setCampaign((current) => ({
      ...current,
      content: { ...current.content, ...values },
    }));
  }

  async function copySignupUrl() {
    if (!data?.signupUrl) return;
    try {
      await navigator.clipboard.writeText(data.signupUrl);
      setMessage("Signup link copied.");
    } catch {
      setError("The browser could not copy the signup link.");
    }
  }

  const usagePercent = useMemo(() => {
    if (!data?.limits.maxSendsPerMonth) return 0;
    return Math.min(
      100,
      ((data.limits.sendsThisMonth + data.limits.reservedThisMonth) /
        data.limits.maxSendsPerMonth) *
        100,
    );
  }, [data]);

  if (loading)
    return (
      <section className="newsletter-loading">
        <LoadingIndicator size={20} />
        <span>Loading newsletter workspace</span>
      </section>
    );
  if (!data)
    return (
      <section className="newsletter-empty">
        <Mail size={28} />
        <h2>Newsletter unavailable</h2>
        <p>{error || "Reload the page and try again."}</p>
        <button
          className="button secondary"
          onClick={() => void load(true)}
          type="button"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </section>
    );
  return (
    <section className="newsletter-workspace">
      <header className="newsletter-heading">
        <div>
          <p className="dashboard-kicker">Audience</p>
          <h2>Newsletter</h2>
          <p>
            Send useful updates through your own SMTP server and keep the
            audience attached to this workspace.
          </p>
        </div>
        {data.signupUrl && (
          <button
            className="button secondary compact"
            onClick={copySignupUrl}
            type="button"
          >
            <Copy aria-hidden="true" size={15} />
            Copy signup link
          </button>
        )}
      </header>

      <nav aria-label="Newsletter sections" className="newsletter-tabs">
        {(
          ["overview", "campaigns", "subscribers", "smtp"] as NewsletterView[]
        ).map((item) => (
          <button
            className={view === item ? "active" : ""}
            key={item}
            onClick={() => setView(item)}
            type="button"
          >
            {item === "smtp" ? "SMTP" : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>
      {error && (
        <p className="error newsletter-feedback" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success newsletter-feedback" role="status">
          <Check aria-hidden="true" size={16} />
          {message}
        </p>
      )}

      {view === "overview" && (
        <div className="newsletter-overview">
          <section
            className="newsletter-metrics"
            aria-label="Newsletter summary"
          >
            <article>
              <span>Active subscribers</span>
              <strong>{data.subscriberCounts.active}</strong>
              <small>
                {data.subscriberCounts.pending} waiting for confirmation
              </small>
            </article>
            <article>
              <span>Sends this month</span>
              <strong>{data.limits.sendsThisMonth}</strong>
              <small>
                {data.limits.maxSendsPerMonth === null
                  ? "No OrbitPage limit"
                  : `${data.limits.maxSendsPerMonth} monthly limit`}
              </small>
            </article>
            <article>
              <span>Campaigns</span>
              <strong>{data.campaigns.length}</strong>
              <small>
                {
                  data.campaigns.filter((item) => item.status === "scheduled")
                    .length
                }{" "}
                scheduled
              </small>
            </article>
            <article>
              <span>SMTP</span>
              <strong className="newsletter-metric-status">
                {data.settings.verifiedAt
                  ? "Ready"
                  : data.settings.configured
                    ? "Verify"
                    : "Connect"}
              </strong>
              <small>{data.settings.host || "No server configured"}</small>
            </article>
          </section>
          <section className="newsletter-usage-band">
            <div>
              <strong>Monthly delivery allowance</strong>
              <span>
                {data.limits.sendsThisMonth + data.limits.reservedThisMonth}{" "}
                used or reserved{" "}
                {data.limits.maxSendsPerMonth === null
                  ? ""
                  : `of ${data.limits.maxSendsPerMonth}`}
              </span>
            </div>
            <div
              className="newsletter-usage-track"
              aria-label={`${Math.round(usagePercent)} percent used`}
            >
              <span style={{ transform: `scaleX(${usagePercent / 100})` }} />
            </div>
          </section>
          <section className="newsletter-recent">
            <header>
              <div>
                <p className="dashboard-kicker">Recent</p>
                <h3>Campaign performance</h3>
              </div>
              <button
                className="button ghost compact"
                onClick={() => setView("campaigns")}
                type="button"
              >
                Open campaigns
              </button>
            </header>
            {data.campaigns.length === 0 ? (
              <div className="newsletter-zero">
                <Send size={22} />
                <div>
                  <strong>No campaigns yet</strong>
                  <span>
                    Start with a focused update rather than a generic mass
                    email.
                  </span>
                </div>
                <button
                  className="button secondary compact"
                  onClick={() => setView("campaigns")}
                  type="button"
                >
                  <Plus size={15} />
                  Create campaign
                </button>
              </div>
            ) : (
              data.campaigns
                .slice(0, 5)
                .map((item) => (
                  <CampaignReport campaign={item} key={item.campaignId} />
                ))
            )}
          </section>
        </div>
      )}

      {view === "smtp" && (
        <div className="newsletter-smtp-layout">
          <form className="newsletter-smtp-form" onSubmit={saveSmtp}>
            <header>
              <div>
                <p className="dashboard-kicker">Connection</p>
                <h3>Your SMTP server</h3>
              </div>
              {data.settings.verifiedAt && (
                <span className="newsletter-verified">
                  <ShieldCheck size={15} />
                  Verified
                </span>
              )}
            </header>
            <div className="newsletter-form-grid">
              <label className="field wide">
                <span className="label">SMTP host</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setSmtp((value) => ({ ...value, host: event.target.value }))
                  }
                  placeholder="smtp.example.com"
                  required
                  value={smtp.host}
                />
              </label>
              <label className="field">
                <span className="label">Port</span>
                <select
                  className="input"
                  onChange={(event) =>
                    setSmtp((value) => ({
                      ...value,
                      port: Number(event.target.value),
                    }))
                  }
                  value={smtp.port}
                >
                  <option value={465}>465 · TLS</option>
                  <option value={587}>587 · STARTTLS</option>
                  <option value={2525}>2525 · STARTTLS</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Username</span>
                <input
                  autoComplete="username"
                  className="input"
                  onChange={(event) =>
                    setSmtp((value) => ({
                      ...value,
                      username: event.target.value,
                    }))
                  }
                  required
                  value={smtp.username}
                />
              </label>
              <label className="field">
                <span className="label">Password</span>
                <input
                  autoComplete="new-password"
                  className="input"
                  onChange={(event) =>
                    setSmtp((value) => ({
                      ...value,
                      password: event.target.value,
                    }))
                  }
                  placeholder={
                    data.settings.passwordConfigured
                      ? "Leave blank to keep it"
                      : "SMTP password"
                  }
                  required={!data.settings.passwordConfigured}
                  type="password"
                  value={smtp.password}
                />
              </label>
              <label className="field">
                <span className="label">Sender name</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setSmtp((value) => ({
                      ...value,
                      fromName: event.target.value,
                    }))
                  }
                  required
                  value={smtp.fromName}
                />
              </label>
              <label className="field">
                <span className="label">Sender email</span>
                <input
                  className="input"
                  onChange={(event) =>
                    setSmtp((value) => ({
                      ...value,
                      fromEmail: event.target.value,
                    }))
                  }
                  required
                  type="email"
                  value={smtp.fromEmail}
                />
              </label>
              <label className="field">
                <span className="label">
                  Reply-to <small>optional</small>
                </span>
                <input
                  className="input"
                  onChange={(event) =>
                    setSmtp((value) => ({
                      ...value,
                      replyTo: event.target.value,
                    }))
                  }
                  type="email"
                  value={smtp.replyTo}
                />
              </label>
            </div>
            <footer>
              <button
                aria-busy={action === "smtp-save"}
                className="button"
                disabled={action !== null}
                type="submit"
              >
                {action === "smtp-save" ? (
                  <LoadingIndicator size={16} />
                ) : (
                  <Server size={16} />
                )}
                Save connection
              </button>
              <button
                aria-busy={action === "smtp-test"}
                className="button secondary"
                disabled={action !== null || !data.settings.configured}
                onClick={testSmtp}
                type="button"
              >
                {action === "smtp-test" ? (
                  <LoadingIndicator size={16} />
                ) : (
                  <Send size={16} />
                )}
                Verify and send test
              </button>
            </footer>
          </form>
          <aside className="newsletter-smtp-notes">
            <Server aria-hidden="true" size={24} />
            <h3>Before the first campaign</h3>
            <ol>
              <li>Use a sender address authorized by your SMTP provider.</li>
              <li>Configure SPF, DKIM and DMARC on the sender domain.</li>
              <li>
                Send the verification message and check that it arrives
                correctly.
              </li>
            </ol>
            <p>
              OrbitPage requires TLS and blocks private network destinations.
              Passwords are encrypted at rest and never returned to the browser.
            </p>
          </aside>
        </div>
      )}

      {view === "subscribers" && (
        <div className="newsletter-subscriber-layout">
          <section className="newsletter-subscriber-tools">
            <form onSubmit={addSubscriber}>
              <header>
                <div>
                  <p className="dashboard-kicker">Manual entry</p>
                  <h3>Add a subscriber</h3>
                </div>
                <UserRoundPlus size={21} />
              </header>
              <div className="newsletter-form-grid">
                <label className="field">
                  <span className="label">Email</span>
                  <input
                    className="input"
                    onChange={(event) =>
                      setSubscriber((value) => ({
                        ...value,
                        email: event.target.value,
                      }))
                    }
                    required
                    type="email"
                    value={subscriber.email}
                  />
                </label>
                <label className="field">
                  <span className="label">
                    Name <small>optional</small>
                  </span>
                  <input
                    className="input"
                    onChange={(event) =>
                      setSubscriber((value) => ({
                        ...value,
                        name: event.target.value,
                      }))
                    }
                    value={subscriber.name}
                  />
                </label>
              </div>
              <label className="newsletter-consent">
                <input
                  checked={subscriber.consentConfirmed}
                  onChange={(event) =>
                    setSubscriber((value) => ({
                      ...value,
                      consentConfirmed: event.target.checked,
                    }))
                  }
                  required
                  type="checkbox"
                />
                <span>
                  I confirm this person explicitly agreed to receive marketing
                  email from this workspace.
                </span>
              </label>
              <button
                aria-busy={action === "subscriber-add"}
                className="button"
                disabled={action !== null}
                type="submit"
              >
                {action === "subscriber-add" ? (
                  <LoadingIndicator size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Add subscriber
              </button>
            </form>
            <aside>
              <Link2 size={20} />
              <div>
                <strong>Public signup</strong>
                <span>
                  Share a hosted form with double opt-in. New addresses stay
                  pending until they click the confirmation email.
                </span>
              </div>
              {data.signupUrl && (
                <>
                  <input
                    aria-label="Newsletter signup URL"
                    readOnly
                    value={data.signupUrl}
                  />
                  <button
                    className="button secondary compact"
                    onClick={copySignupUrl}
                    type="button"
                  >
                    <Copy size={15} />
                    Copy
                  </button>
                </>
              )}
            </aside>
          </section>
          <section className="newsletter-subscriber-list">
            <header>
              <div>
                <p className="dashboard-kicker">Audience</p>
                <h3>{data.subscriberCounts.total} subscribers</h3>
              </div>
              <span>
              {data.limits.maxSubscribers === null
                  ? "No OrbitPage limit"
                  : `${data.subscriberCounts.active + data.subscriberCounts.pending}/${data.limits.maxSubscribers} active or pending`}
              </span>
            </header>
            {data.subscribers.length === 0 ? (
              <div className="newsletter-zero">
                <UsersRound size={22} />
                <div>
                  <strong>No subscribers yet</strong>
                  <span>
                    Add consented contacts or share the public signup form.
                  </span>
                </div>
              </div>
            ) : (
              <div className="newsletter-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Subscriber</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Added</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscribers.map((item) => (
                      <tr key={item.subscriberId}>
                        <td>
                          <strong>{item.name || item.email}</strong>
                          {item.name && <span>{item.email}</span>}
                        </td>
                        <td>
                          <span className={`newsletter-status ${item.status}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.source}</td>
                        <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button
                            aria-label={`Remove ${item.email}`}
                            className="newsletter-icon-button"
                            disabled={action !== null}
                            onClick={() =>
                              void removeSubscriber(item.subscriberId)
                            }
                            type="button"
                          >
                            {action ===
                            `subscriber-remove:${item.subscriberId}` ? (
                              <LoadingIndicator size={14} />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {view === "campaigns" && (
        <div className="newsletter-campaign-layout">
          <form className="newsletter-composer" onSubmit={saveCampaign}>
            <header>
              <div>
                <p className="dashboard-kicker">Composer</p>
                <h3>
                  {campaign.campaignId ? "Edit campaign" : "New campaign"}
                </h3>
              </div>
              {campaign.campaignId && (
                <button
                  className="button ghost compact"
                  onClick={() =>
                    setCampaign({
                      ...EMPTY_CAMPAIGN,
                      content: { ...EMPTY_CAMPAIGN.content },
                    })
                  }
                  type="button"
                >
                  New draft
                </button>
              )}
            </header>
            <div
              className="newsletter-template-row"
              aria-label="Campaign templates"
            >
              <button
                onClick={() =>
                  setCampaign(
                    templateCampaign("restaurant", data.settings.fromName),
                  )
                }
                type="button"
              >
                Restaurant
              </button>
              <button
                onClick={() =>
                  setCampaign(templateCampaign("venue", data.settings.fromName))
                }
                type="button"
              >
                Venue
              </button>
              <button
                onClick={() =>
                  setCampaign(
                    templateCampaign("general", data.settings.fromName),
                  )
                }
                type="button"
              >
                General
              </button>
            </div>
            <div className="newsletter-composer-fields">
              <label className="field">
                <span className="label">Internal campaign name</span>
                <input
                  className="input"
                  maxLength={100}
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      name: event.target.value,
                    }))
                  }
                  required
                  value={campaign.name}
                />
              </label>
              <label className="field">
                <span className="label">Email subject</span>
                <input
                  className="input"
                  maxLength={160}
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      subject: event.target.value,
                    }))
                  }
                  required
                  value={campaign.subject}
                />
              </label>
              <label className="field">
                <span className="label">Inbox preview</span>
                <input
                  className="input"
                  maxLength={200}
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      preheader: event.target.value,
                    }))
                  }
                  value={campaign.preheader}
                />
              </label>
              <label className="field">
                <span className="label">Eyebrow</span>
                <input
                  className="input"
                  maxLength={60}
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      content: {
                        ...value.content,
                        eyebrow: event.target.value,
                      },
                    }))
                  }
                  value={campaign.content.eyebrow}
                />
              </label>
              <label className="field">
                <span className="label">Headline</span>
                <input
                  className="input"
                  maxLength={140}
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      content: {
                        ...value.content,
                        headline: event.target.value,
                      },
                    }))
                  }
                  required
                  value={campaign.content.headline}
                />
              </label>
              <label className="field">
                <span className="label">
                  Image URL <small>optional, HTTPS</small>
                </span>
                <input
                  className="input"
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      content: {
                        ...value.content,
                        imageUrl: event.target.value,
                      },
                    }))
                  }
                  type="url"
                  value={campaign.content.imageUrl}
                />
              </label>
              <label className="field">
                <span className="label">
                  Image description <small>for accessibility</small>
                </span>
                <input
                  className="input"
                  maxLength={160}
                  onChange={(event) =>
                    updateCampaignContent({ imageAlt: event.target.value })
                  }
                  value={campaign.content.imageAlt}
                />
              </label>
              <label className="field">
                <span className="label">
                  Brand logo URL <small>optional, HTTPS</small>
                </span>
                <input
                  className="input"
                  onChange={(event) =>
                    updateCampaignContent({ logoUrl: event.target.value })
                  }
                  type="url"
                  value={campaign.content.logoUrl}
                />
              </label>
              <label className="field full">
                <span className="label">Message</span>
                <textarea
                  className="input"
                  maxLength={12000}
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      content: { ...value.content, body: event.target.value },
                    }))
                  }
                  required
                  rows={7}
                  value={campaign.content.body}
                />
              </label>
              <label className="field">
                <span className="label">Button label</span>
                <input
                  className="input"
                  maxLength={60}
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      content: {
                        ...value.content,
                        ctaLabel: event.target.value,
                      },
                    }))
                  }
                  value={campaign.content.ctaLabel}
                />
              </label>
              <label className="field">
                <span className="label">
                  Button URL <small>HTTPS</small>
                </span>
                <input
                  className="input"
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      content: { ...value.content, ctaUrl: event.target.value },
                    }))
                  }
                  type="url"
                  value={campaign.content.ctaUrl}
                />
              </label>
              <label className="field">
                <span className="label">Footer note</span>
                <input
                  className="input"
                  maxLength={500}
                  onChange={(event) =>
                    setCampaign((value) => ({
                      ...value,
                      content: {
                        ...value.content,
                        footerNote: event.target.value,
                      },
                    }))
                  }
                  value={campaign.content.footerNote}
                />
              </label>
              <fieldset className="newsletter-design-panel">
                <legend>Brand &amp; layout</legend>
                <div
                  aria-label="Email design presets"
                  className="newsletter-design-presets"
                >
                  {DESIGN_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => updateCampaignContent(preset.values)}
                      type="button"
                    >
                      <span
                        style={{
                          background: preset.values.contentBackgroundColor,
                          borderColor: preset.values.accentColor,
                        }}
                      />
                      {preset.name}
                    </button>
                  ))}
                </div>
                <div className="newsletter-design-controls">
                  <label className="field">
                    <span className="label">Typography</span>
                    <select
                      className="input"
                      onChange={(event) =>
                        updateCampaignContent({
                          fontFamily: event.target
                            .value as NewsletterCampaignContent["fontFamily"],
                        })
                      }
                      value={campaign.content.fontFamily}
                    >
                      <option value="system">Clean sans</option>
                      <option value="editorial">Editorial serif</option>
                      <option value="modern">Modern sans</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Text alignment</span>
                    <select
                      className="input"
                      onChange={(event) =>
                        updateCampaignContent({
                          textAlign: event.target
                            .value as NewsletterCampaignContent["textAlign"],
                        })
                      }
                      value={campaign.content.textAlign}
                    >
                      <option value="left">Left</option>
                      <option value="center">Centered</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Email width</span>
                    <select
                      className="input"
                      onChange={(event) =>
                        updateCampaignContent({
                          containerWidth: Number(
                            event.target.value,
                          ) as NewsletterCampaignContent["containerWidth"],
                        })
                      }
                      value={campaign.content.containerWidth}
                    >
                      <option value={520}>Compact</option>
                      <option value={640}>Standard</option>
                      <option value={720}>Wide</option>
                    </select>
                  </label>
                  <label className="field newsletter-range-field">
                    <span className="label">
                      Card corners <small>{campaign.content.cornerRadius}px</small>
                    </span>
                    <RangeSlider
                      aria-label="Card corners"
                      max={24}
                      min={0}
                      onChange={(event) =>
                        updateCampaignContent({
                          cornerRadius: Number(event.target.value),
                        })
                      }
                      value={campaign.content.cornerRadius}
                      valueLabel={`${campaign.content.cornerRadius}px`}
                    />
                  </label>
                  <label className="field newsletter-range-field">
                    <span className="label">
                      Button corners <small>{campaign.content.buttonRadius}px</small>
                    </span>
                    <RangeSlider
                      aria-label="Button corners"
                      max={28}
                      min={0}
                      onChange={(event) =>
                        updateCampaignContent({
                          buttonRadius: Number(event.target.value),
                        })
                      }
                      value={campaign.content.buttonRadius}
                      valueLabel={`${campaign.content.buttonRadius}px`}
                    />
                  </label>
                </div>
                <div className="newsletter-color-fields">
                  {([
                    ["Accent", "accentColor"],
                    ["Canvas", "backgroundColor"],
                    ["Email", "contentBackgroundColor"],
                    ["Text", "contentColor"],
                    ["Button text", "buttonTextColor"],
                  ] as const).map(([label, key]) => (
                    <div className="newsletter-color-field" key={key}>
                      <span>{label}</span>
                      <ColorPicker
                        label={`${label} color`}
                        onChange={(value) => updateCampaignContent({ [key]: value })}
                        value={campaign.content[key]}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
            <footer className="newsletter-composer-actions">
              <button
                aria-busy={action === "campaign-save"}
                className="button secondary"
                disabled={action !== null}
                type="submit"
              >
                {action === "campaign-save" ? (
                  <LoadingIndicator size={16} />
                ) : (
                  <Check size={16} />
                )}
                Save draft
              </button>
              <button
                className="button"
                disabled={action !== null || !data.settings.verifiedAt}
                onClick={() => void queueCampaign("now")}
                type="button"
              >
                <Send size={16} />
                Send now
              </button>
              <div className="newsletter-schedule-action">
                <input
                  aria-label="Schedule date and time"
                  min={minimumLocalScheduleValue()}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  type="datetime-local"
                  value={scheduledFor}
                />
                <button
                  className="button secondary"
                  disabled={
                    action !== null ||
                    !scheduledFor ||
                    !data.settings.verifiedAt
                  }
                  onClick={() => void queueCampaign("schedule")}
                  type="button"
                >
                  <CalendarClock size={16} />
                  Schedule
                </button>
              </div>
            </footer>
            {!data.settings.verifiedAt && (
              <p className="newsletter-inline-warning">
                Verify the SMTP connection before sending or scheduling.
              </p>
            )}
          </form>
          <aside className="newsletter-preview-column">
            <div className="newsletter-preview-label">
              <span>Preview</span>
              <small>{campaign.subject || "Email subject"}</small>
            </div>
            <div
              className="newsletter-email-preview"
              style={{
                background: campaign.content.backgroundColor,
                color: campaign.content.contentColor,
                fontFamily: campaignFontStack(campaign.content.fontFamily),
              }}
            >
              <div
                className="newsletter-email-preview-card"
                style={{
                  background: campaign.content.contentBackgroundColor,
                  borderRadius: campaign.content.cornerRadius,
                  maxWidth: campaign.content.containerWidth,
                  textAlign: campaign.content.textAlign,
                }}
              >
                {campaign.content.imageUrl.startsWith("https://") && (
                  <img
                    alt={campaign.content.imageAlt}
                    className="newsletter-preview-hero"
                    src={campaign.content.imageUrl}
                  />
                )}
                <div className="newsletter-preview-content">
                  {campaign.content.logoUrl.startsWith("https://") && (
                    <img
                      alt=""
                      className="newsletter-preview-logo"
                      src={campaign.content.logoUrl}
                    />
                  )}
                <small style={{ color: campaign.content.accentColor }}>
                  {campaign.content.eyebrow}
                </small>
                <h3>{campaign.content.headline || "Campaign headline"}</h3>
                {campaign.content.body
                  .split(/\n{2,}/)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                {campaign.content.ctaLabel && (
                  <span
                    className="newsletter-preview-cta"
                    style={{
                      background: campaign.content.accentColor,
                      borderRadius: campaign.content.buttonRadius,
                      color: campaign.content.buttonTextColor,
                    }}
                  >
                    {campaign.content.ctaLabel}
                  </span>
                )}
                <footer>
                  {campaign.content.footerNote}
                  <br />
                  <u>Unsubscribe</u>
                </footer>
                </div>
              </div>
            </div>
          </aside>
          <section className="newsletter-campaign-list">
            <header>
              <div>
                <p className="dashboard-kicker">History</p>
                <h3>Campaigns and delivery reports</h3>
              </div>
            </header>
            {data.campaigns.length === 0 ? (
              <div className="newsletter-zero">
                <Mail size={22} />
                <div>
                  <strong>No saved campaigns</strong>
                  <span>Choose a template or start from a blank draft.</span>
                </div>
              </div>
            ) : (
              data.campaigns.map((item) => (
                <div className="newsletter-campaign-row" key={item.campaignId}>
                  <CampaignReport campaign={item} />
                  <div className="newsletter-campaign-actions">
                    {item.status === "draft" && (
                      <button
                        className="button ghost compact"
                        onClick={() => {
                          setCampaign(campaignFromSaved(item));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                    )}
                    {item.status === "scheduled" && (
                      <button
                        className="button ghost compact"
                        onClick={() => void cancelCampaign(item.campaignId)}
                        type="button"
                      >
                        Cancel send
                      </button>
                    )}
                    {canDeleteNewsletterCampaign(item.status) && (
                      <button
                        aria-label={`Delete ${item.name} permanently`}
                        className="newsletter-icon-button"
                        disabled={action !== null}
                        onClick={() => setCampaignToDelete(item)}
                        title="Delete campaign and delivery report"
                        type="button"
                      >
                        {action === `campaign-delete:${item.campaignId}` ? (
                          <LoadingIndicator size={14} />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      )}
      {campaignToDelete && (
        <div
          aria-labelledby="delete-campaign-title"
          aria-modal="true"
          className="newsletter-dialog-backdrop"
          ref={deleteDialogRef}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && action === null)
              setCampaignToDelete(null);
          }}
          role="dialog"
          tabIndex={-1}
        >
          <div className="newsletter-delete-dialog">
            <span className="newsletter-delete-icon">
              <Trash2 aria-hidden="true" size={20} />
            </span>
            <div>
              <p className="dashboard-kicker">Permanent action</p>
              <h3 id="delete-campaign-title">Delete this campaign?</h3>
              <p>
                <strong>{campaignToDelete.name}</strong>, its delivery report,
                opens and click records will be removed. This cannot be undone.
              </p>
              {campaignToDelete.status === "scheduled" && (
                <p className="newsletter-delete-note">
                  The scheduled send will be canceled and its reserved monthly
                  allowance released.
                </p>
              )}
            </div>
            <footer>
              <button
                className="button secondary"
                disabled={action !== null}
                onClick={() => setCampaignToDelete(null)}
                type="button"
              >
                Keep campaign
              </button>
              <button
                aria-busy={action !== null}
                className="button danger-button"
                disabled={action !== null}
                onClick={() => void deleteCampaign()}
                type="button"
              >
                {action !== null ? (
                  <LoadingIndicator size={16} />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete permanently
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}

function CampaignReport({ campaign }: { campaign: NewsletterCampaign }) {
  const delivered = campaign.stats.accepted + campaign.stats.rejected;
  return (
    <article className="newsletter-report">
      <div className="newsletter-report-main">
        <span className={`newsletter-status ${campaign.status}`}>
          {campaign.status}
        </span>
        <strong>{campaign.name}</strong>
        <small>
          {campaign.scheduledFor
            ? new Date(campaign.scheduledFor).toLocaleString()
            : new Date(campaign.updatedAt).toLocaleDateString()}
        </small>
      </div>
      <div className="newsletter-report-metrics">
        <span title="Accepted by SMTP">
          <Send size={14} />
          {campaign.stats.accepted}
          <small>accepted</small>
        </span>
        <span title="Unique opens">
          <Eye size={14} />
          {percent(campaign.stats.openedUnique, campaign.stats.accepted)}
          <small>opened</small>
        </span>
        <span title="Unique clicks">
          <MousePointerClick size={14} />
          {percent(campaign.stats.clickedUnique, campaign.stats.accepted)}
          <small>clicked</small>
        </span>
        <span title="Rejected by SMTP">
          <Mail size={14} />
          {delivered ? percent(campaign.stats.rejected, delivered) : "0%"}
          <small>rejected</small>
        </span>
      </div>
      {campaign.lastError && (
        <p className="newsletter-report-error">{campaign.lastError}</p>
      )}
    </article>
  );
}
