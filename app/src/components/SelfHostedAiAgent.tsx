import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Send, ShieldCheck, Sparkles, X } from "@/components/ui/material-icons";
import {
  aiPageAgentApi,
  type AiConversationMessage,
  type AiPageProposal,
  type AiSettings,
} from "@/lib/api-client";
import { useAppI18n } from "@/lib/i18n";
import { OrbitLoader } from "@/components/ui/orbit-loader";

type AgentMessage = AiConversationMessage & {
  id: string;
  proposal?: AiPageProposal | null;
  error?: boolean;
  applying?: boolean;
  applied?: boolean;
};

function message(role: AgentMessage["role"], content: string, error = false): AgentMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    error,
  };
}

export function SelfHostedAiAgent({ onApplied }: { onApplied?: () => void }) {
  const { tr } = useAppI18n();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const labels = useMemo(() => ({
    tagline: tr("Edit your page with confirmation", "Modifica la pagina con conferma"),
    launch: tr("Edit with AI", "Modifica con AI"),
    close: tr("Close AI assistant", "Chiudi assistente AI"),
    welcome: tr(
      "Tell me what you want to change on the open page. I will show you the edits to review before you apply them.",
      "Dimmi cosa vuoi cambiare nella pagina aperta. Ti mostrerò le modifiche da controllare prima di applicarle.",
    ),
    configure: tr(
      "Connect an OpenAI API key from the AI Agent section to start editing.",
      "Collega una chiave API OpenAI dalla sezione Agente AI per iniziare a modificare.",
    ),
    placeholder: tr(
      "E.g. Make the bio more direct and move bookings first…",
      "Es. Rendi la bio più diretta e sposta le prenotazioni al primo posto…",
    ),
    thinking: tr("Reviewing your page…", "Sto analizzando la pagina…"),
    review: tr("Proposed changes", "Modifiche proposte"),
    apply: tr("Apply changes", "Applica modifiche"),
    applying: tr("Applying…", "Applicazione…"),
    applied: tr("Changes applied.", "Modifiche applicate."),
    safety: tr(
      "No change is applied without your confirmation.",
      "Nessuna modifica viene applicata senza la tua conferma.",
    ),
  }), [tr]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void aiPageAgentApi.settings()
      .then((nextSettings) => {
        if (!cancelled) setSettings(nextSettings);
      })
      .catch(() => {
        if (!cancelled) setSettings(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || messages.length > 0) return;
    setMessages([message("assistant", settings?.configured === false ? labels.configure : labels.welcome)]);
  }, [labels.configure, labels.welcome, messages.length, open, settings?.configured]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || sending || settings?.configured !== true) return;
    const userMessage = message("user", prompt);
    const history = messages
      .filter((item) => !item.error)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setSending(true);
    try {
      const result = await aiPageAgentApi.plan(prompt, history);
      setMessages((current) => [...current, {
        ...message("assistant", result.reply),
        proposal: result.proposal,
      }]);
    } catch (error) {
      setMessages((current) => [...current, message(
        "assistant",
        error instanceof Error ? error.message : tr("The proposal could not be prepared.", "Impossibile preparare la proposta."),
        true,
      )]);
    } finally {
      setSending(false);
    }
  };

  const applyProposal = async (messageId: string, proposal: AiPageProposal) => {
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, applying: true } : item));
    try {
      await aiPageAgentApi.commit(proposal.previewToken);
      setMessages((current) => current.map((item) => item.id === messageId
        ? { ...item, applying: false, applied: true, content: `${item.content}\n\n${labels.applied}` }
        : item));
      onApplied?.();
    } catch (error) {
      setMessages((current) => current.map((item) => item.id === messageId
        ? {
            ...item,
            applying: false,
            error: true,
            content: `${item.content}\n\n${error instanceof Error ? error.message : tr("The changes could not be applied.", "Impossibile applicare le modifiche.")}`,
          }
        : item));
    }
  };

  const panel = open && typeof document !== "undefined" ? createPortal(
        <section aria-label="OrbitPage AI" className="ai-page-agent-panel" role="dialog">
          <header className="ai-page-agent-header">
            <span className="ai-page-agent-mark" aria-hidden="true"><Sparkles size={18} /></span>
            <div><strong>OrbitPage AI</strong><small>{labels.tagline}</small></div>
            <button ref={closeRef} aria-label={labels.close} onClick={() => { setOpen(false); launcherRef.current?.focus(); }} type="button"><X size={18} /></button>
          </header>

          <div aria-live="polite" className="ai-page-agent-messages" ref={listRef}>
            {messages.map((item) => (
              <div className={`ai-page-agent-message ${item.role}${item.error ? " error" : ""}`} key={item.id}>
                <p>{item.content}</p>
                {item.proposal && (
                  <section className="ai-page-agent-proposal">
                    <div className="ai-page-agent-proposal-heading">
                      <ShieldCheck aria-hidden="true" size={17} />
                      <div><strong>{labels.review}</strong><span>{item.proposal.summary}</span></div>
                    </div>
                    <ul>{item.proposal.changes.map((change, index) => <li key={`${item.id}-${index}`}><Check aria-hidden="true" size={14} />{change}</li>)}</ul>
                    <small>{tr("Review every item before applying.", "Controlla ogni voce prima di applicare.")}</small>
                    <button disabled={item.applying || item.applied} onClick={() => void applyProposal(item.id, item.proposal!)} type="button">
                      {item.applying
                        ? <><OrbitLoader size={16} state="weaving" />{labels.applying}</>
                        : item.applied
                          ? <><Check aria-hidden="true" size={16} />{labels.applied}</>
                          : <><Sparkles aria-hidden="true" size={16} />{labels.apply}</>}
                    </button>
                  </section>
                )}
              </div>
            ))}
            {sending && <div className="ai-page-agent-thinking" role="status"><OrbitLoader size={16} state="solving" />{labels.thinking}</div>}
          </div>

          <form className="ai-page-agent-composer" onSubmit={submit}>
            <textarea
              aria-label={labels.placeholder}
              disabled={sending || settings?.configured !== true}
              maxLength={4000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={settings?.configured === false ? labels.configure : labels.placeholder}
              rows={3}
              value={draft}
            />
            <button aria-label={tr("Send", "Invia")} disabled={sending || settings?.configured !== true || !draft.trim()} type="submit"><Send size={17} /></button>
          </form>
          <p className="ai-page-agent-safety"><ShieldCheck aria-hidden="true" size={13} /><span>{labels.safety}</span></p>
        </section>,
        document.body,
      ) : null;

  return (
    <div className={`ai-page-agent${open ? " is-open" : ""}`}>
      {panel}
      <button ref={launcherRef} aria-expanded={open} aria-label={labels.launch} className="ai-page-agent-launcher" onClick={() => setOpen((current) => !current)} type="button">
        <Sparkles aria-hidden="true" size={19} /><span>{labels.launch}</span>
      </button>
    </div>
  );
}
