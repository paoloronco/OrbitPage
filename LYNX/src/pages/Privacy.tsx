import { useEffect, useRef } from "react";
import {
  isUsercentricsPrivacyPageEnabled,
  usercentricsPrivacyPolicyId,
  usercentricsPrivacyPolicyLanguage,
} from "@/config/legal";

const SCRIPT_ID = "usercentrics-ppg";
const SCRIPT_SRC = "https://policygenerator.usercentrics.eu/api/privacy-policy";

const Privacy = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUsercentricsPrivacyPageEnabled) return;

    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.setAttribute("privacy-policy-id", usercentricsPrivacyPolicyId);
    script.setAttribute("data-language", usercentricsPrivacyPolicyLanguage);
    script.src = SCRIPT_SRC;
    script.async = true;

    document.body.appendChild(script);

    return () => {
      script.remove();
      containerRef.current?.replaceChildren();
    };
  }, []);

  return (
    <main className="min-h-screen bg-white px-4 py-10 text-slate-950" style={{ colorScheme: "light" }}>
      <div className="mx-auto w-full max-w-3xl">
        <a className="text-sm text-slate-600 underline hover:text-blue-700" href="/">
          Back to home
        </a>

        <header className="mt-8 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This page contains the current privacy policy for this Lynx instance.
          </p>
        </header>

        {isUsercentricsPrivacyPageEnabled ? (
          <div
            ref={containerRef}
            className="uc-privacy-policy rounded-lg border border-slate-200 bg-white p-5 text-slate-900 shadow-sm [&_*]:!bg-transparent [&_*]:!text-slate-900 [&_a]:!text-blue-700 [&_a]:underline [&_a]:underline-offset-2"
            style={{ colorScheme: "light" }}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Privacy policy embed is not configured for this deployment.
          </div>
        )}
      </div>
    </main>
  );
};

export default Privacy;
