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
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-3xl">
        <a className="text-sm text-muted-foreground underline hover:text-primary" href="/">
          Back to home
        </a>

        <header className="mt-8 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This page contains the current privacy policy for this Lynx instance.
          </p>
        </header>

        {isUsercentricsPrivacyPageEnabled ? (
          <div ref={containerRef} className="uc-privacy-policy" />
        ) : (
          <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            Privacy policy embed is not configured for this deployment.
          </div>
        )}
      </div>
    </main>
  );
};

export default Privacy;
