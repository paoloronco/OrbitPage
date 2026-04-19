import { useEffect, useRef, useState } from "react";
import { consentConfigPublicApi, type ConsentConfigData } from "@/lib/api-client";

type PolicyKind = "privacy" | "cookie";
type PolicyState = NonNullable<ConsentConfigData["legalPolicies"]>["privacyPolicy"];

const TITLES: Record<PolicyKind, string> = {
  privacy: "Privacy Policy",
  cookie: "Cookie Policy",
};

const PATHS: Record<PolicyKind, string> = {
  privacy: "/privacy",
  cookie: "/cookies",
};

const getPolicy = (data: ConsentConfigData | undefined, kind: PolicyKind): PolicyState | null => {
  const policies = data?.legalPolicies;
  if (!policies) return null;
  return kind === "privacy" ? policies.privacyPolicy : policies.cookiePolicy;
};

const activateEmbeddedScripts = (container: HTMLElement) => {
  container.querySelectorAll("script").forEach((script) => {
    const activeScript = document.createElement("script");
    for (const attr of Array.from(script.attributes)) {
      activeScript.setAttribute(attr.name, attr.value);
    }
    activeScript.text = script.text;
    script.replaceWith(activeScript);
  });
};

export function LegalPolicyPage({ kind }: { kind: PolicyKind }) {
  const [policy, setPolicy] = useState<PolicyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const embedRef = useRef<HTMLDivElement>(null);
  const title = TITLES[kind];
  const path = PATHS[kind];

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await consentConfigPublicApi.get();
        if (cancelled) return;
        const nextPolicy = getPolicy(res.data, kind);
        setPolicy(nextPolicy);

        const externalUrl = nextPolicy?.externalUrl?.trim();
        if (nextPolicy?.mode === "external" && externalUrl && externalUrl !== path) {
          setRedirecting(true);
          window.location.replace(externalUrl);
          return;
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Policy could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [kind, path]);

  useEffect(() => {
    const container = embedRef.current;
    if (!container) return;
    container.replaceChildren();

    if (policy?.mode !== "embedded" || !policy.embeddedCode?.trim()) return;

    const range = document.createRange();
    range.selectNode(container);
    const fragment = range.createContextualFragment(policy.embeddedCode);
    container.appendChild(fragment);
    activateEmbeddedScripts(container);

    return () => {
      container.replaceChildren();
    };
  }, [policy?.embeddedCode, policy?.mode]);

  const hostedText = policy?.hostedText?.trim() || "";

  return (
    <main className="min-h-screen bg-white px-4 py-10 text-slate-950" style={{ colorScheme: "light" }}>
      <div className="mx-auto w-full max-w-3xl">
        <a className="text-sm text-slate-600 underline hover:text-blue-700" href="/">
          Back to home
        </a>

        <header className="mb-8 mt-8">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This page contains the current {title.toLowerCase()} for this Lynx instance.
          </p>
        </header>

        {loading || redirecting ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            {redirecting ? "Opening policy..." : "Loading policy..."}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : policy?.mode === "hosted" && hostedText ? (
          <article className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 shadow-sm">
            {hostedText}
          </article>
        ) : policy?.mode === "embedded" && policy.embeddedCode?.trim() ? (
          <div
            ref={embedRef}
            className="rounded-lg border border-slate-200 bg-white p-5 text-slate-900 shadow-sm [&_*]:!text-slate-900 [&_a]:!text-blue-700 [&_a]:underline [&_a]:underline-offset-2"
            style={{ colorScheme: "light" }}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            {title} is not configured yet.
          </div>
        )}
      </div>
    </main>
  );
}
