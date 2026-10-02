import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Send, ShieldCheck, Sparkles, Trash2, X } from "@/components/ui/material-icons";
import {
  aiPageAgentApi,
  type AiConversationMessage,
  type AiPageProposal,
  type AiSettings,
} from "@/lib/api-client";
import { useAppI18n } from "@/lib/i18n";
import { OrbitLoader } from "@/components/ui/orbit-loader";
import { useDialogAccessibility } from "@/lib/use-dialog-accessibility";
import { AI_HISTORY_STORAGE_KEY, readAiConversationHistory, writeAiConversationHistory } from "@/lib/ai-conversation-history";
import { AiPageComparisonPreview } from "./AiPageComparisonPreview";

type AgentMessage = AiConversationMessage & {
  id: string;
  proposal?: AiPageProposal | null;
  error?: boolean;
  applying?: boolean;
  applied?: boolean;
  persistent?: boolean;
};

function message(role: AgentMessage["role"], content: string, error = false, persistent = true): AgentMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    error,
    persistent,
  };
}

export function SelfHostedAiAgent({ historyKey = "admin", onApplied }: { historyKey?: string; onApplied?: () => void }) {
  const { tr } = useAppI18n();
  const historyStorageKey = useMemo(() => `${AI_HISTORY_STORAGE_KEY}:${encodeURIComponent(historyKey)}`, [historyKey]);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loadedHistoryKey, setLoadedHistoryKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useDialogAccessibility<HTMLElement>(open, () => setOpen(false), closeRef);
  const labels = useMemo(() => ({
    tagline: tr("Edit your page with confirmation", "Modifica la pagina con conferma"),
    launch: tr("Edit with AI", "Modifica con AI"),
    close: tr("Close AI assistant", "Chiudi assistente AI"),
    clear: tr("Clear conversation", "Svuota chat"),
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
    apply: tr("Apply changes", "Applica modifiche"),
    applying: tr("Applying…", "Applicazione…"),
    applied: tr("Changes applied.", "Modifiche applicate."),
    safety: tr(
      "No change is applied without your confirmation.",
      "Nessuna modifica viene applicata senza la tua conferma.",
    ),
  }), [tr]);

  useEffect(() => {
    setMessages(readAiConversationHistory(historyStorageKey).map(({ role, content }) => message(role, content)));
    setLoadedHistoryKey(historyStorageKey);
  }, [historyStorageKey]);

  useEffect(() => {
    if (loadedHistoryKey !== historyStorageKey) return;
    writeAiConversationHistory(historyStorageKey, messages
      .filter((item) => !item.error && item.persistent !== false)
      .map(({ role, content }) => ({ role, content })));
  }, [historyStorageKey, loadedHistoryKey, messages]);

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
    if (loadedHistoryKey !== historyStorageKey || !open || messages.length > 0) return;
    setMessages([message("assistant", settings?.configured === false ? labels.configure : labels.welcome, false, false)]);
  }, [historyStorageKey, labels.configure, labels.welcome, loadedHistoryKey, messages.length, open, settings?.configured]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || sending || settings?.configured !== true) return;
    const userMessage = message("user", prompt);
    const history = messages
      .filter((item) => !item.error && item.persistent !== false)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current.map((item) => ({ ...item, proposal: null })), userMessage]);
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
        ? { ...item, applying: false, applied: true, proposal: null, content: `${item.content}\n\n${labels.applied}` }
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
        <section aria-label="OrbitPage AI" aria-modal="true" className="ai-page-agent-panel" ref={panelRef} role="dialog" tabIndex={-1}>
          <header className="ai-page-agent-header">
            <span className="ai-page-agent-mark" aria-hidden="true"><Sparkles size={18} /></span>
            <div><strong>OrbitPage AI</strong><small>{labels.tagline}</small></div>
            <button aria-label={labels.clear} disabled={sending || messages.some((item) => item.applying) || !messages.some((item) => item.persistent !== false)} onClick={() => { setMessages([]); setDraft(""); }} title={labels.clear} type="button"><Trash2 size={18} /></button>
            <button ref={closeRef} aria-label={labels.close} onClick={() => { setOpen(false); launcherRef.current?.focus(); }} type="button"><X size={18} /></button>
          </header>

          <div aria-live="polite" className="ai-page-agent-messages" ref={listRef}>
            {messages.map((item) => (
              <div className={`ai-page-agent-message ${item.role}${item.error ? " error" : ""}`} key={item.id}>
                <p>{item.content}</p>
                {item.proposal && (
                  <section className="ai-page-agent-proposal">
                    <AiPageComparisonPreview {...item.proposal.preview} />
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
