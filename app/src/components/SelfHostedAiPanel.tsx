import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  aiPageAgentApi,
  type AiConversationMessage,
  type AiPageProposal,
  type AiSettings,
} from "@/lib/api-client";
import { useAppI18n } from "@/lib/i18n";

type SelfHostedAiPanelProps = {
  canManageSettings: boolean;
  onApplied?: () => void;
};

type ConversationEntry = AiConversationMessage & {
  id: string;
  error?: boolean;
};

const MODEL_LABELS: Record<string, { name: string; detail: string }> = {
  "gpt-5.6-terra": { name: "GPT-5.6 Terra", detail: "Balanced" },
  "gpt-5.6-sol": { name: "GPT-5.6 Sol", detail: "Deep reasoning" },
  "gpt-5.6-luna": { name: "GPT-5.6 Luna", detail: "Fast" },
};

function entry(role: "user" | "assistant", content: string, error = false): ConversationEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    error,
  };
}

export function SelfHostedAiPanel({ canManageSettings, onApplied }: SelfHostedAiPanelProps) {
  const { tr } = useAppI18n();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-5.6-terra");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [messages, setMessages] = useState<ConversationEntry[]>([
    entry(
      "assistant",
      tr(
        "Tell me what should change. I read the current page and prepare a reviewable proposal before touching anything.",
        "Dimmi cosa vuoi cambiare. Leggo la pagina attuale e preparo una proposta da controllare prima di modificare qualsiasi cosa.",
      ),
    ),
  ]);
  const [prompt, setPrompt] = useState("");
  const [planning, setPlanning] = useState(false);
  const [proposal, setProposal] = useState<AiPageProposal | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void aiPageAgentApi.settings()
      .then((value) => {
        if (cancelled) return;
        setSettings(value);
        setSelectedModel(value.model);
      })
      .catch((error) => {
        if (!cancelled) setSettingsError(error instanceof Error ? error.message : "AI settings could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const container = conversationRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, proposal, planning]);

  const conversationHistory = useMemo<AiConversationMessage[]>(() => (
    messages
      .filter((message) => !message.error)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }))
  ), [messages]);

  const saveSettings = async () => {
    if (!canManageSettings || savingSettings) return;
    setSavingSettings(true);
    setSettingsError("");
    try {
      const next = await aiPageAgentApi.saveSettings({
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        model: selectedModel,
      });
      setSettings(next);
      setApiKey("");
      setSettingsSaved(true);
      window.setTimeout(() => setSettingsSaved(false), 2400);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : tr("The settings could not be saved.", "Impossibile salvare le impostazioni."));
    } finally {
      setSavingSettings(false);
    }
  };

  const removeStoredKey = async () => {
    if (!canManageSettings || savingSettings || settings?.source !== "stored") return;
    setSavingSettings(true);
    setSettingsError("");
    try {
      const next = await aiPageAgentApi.saveSettings({
        model: selectedModel,
        removeStoredKey: true,
      });
      setSettings(next);
      setApiKey("");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : tr("The key could not be removed.", "Impossibile rimuovere la chiave."));
    } finally {
      setSavingSettings(false);
    }
  };

  const submitPrompt = async (event: FormEvent) => {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || planning || !settings?.configured) return;
    const userEntry = entry("user", message);
    setMessages((current) => [...current, userEntry]);
    setPrompt("");
    setProposal(null);
    setApplied(false);
    setPlanning(true);
    try {
      const result = await aiPageAgentApi.plan(message, conversationHistory);
      setMessages((current) => [...current, entry("assistant", result.reply)]);
      setProposal(result.proposal);
    } catch (error) {
      setMessages((current) => [
        ...current,
        entry(
          "assistant",
          error instanceof Error ? error.message : tr("I could not prepare the proposal. Try again.", "Non sono riuscito a preparare la proposta. Riprova."),
          true,
        ),
      ]);
    } finally {
      setPlanning(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal || applying) return;
    setApplying(true);
    try {
      const result = await aiPageAgentApi.commit(proposal.previewToken);
      setApplied(true);
      setProposal(null);
      setMessages((current) => [
        ...current,
        entry(
          "assistant",
          result.alreadyApplied
            ? tr("This proposal was already applied.", "Questa proposta era già stata applicata.")
            : tr("Done. The approved changes are now live in your editor.", "Fatto. Le modifiche approvate sono ora presenti nell'editor."),
        ),
      ]);
      onApplied?.();
    } catch (error) {
      setMessages((current) => [
        ...current,
        entry(
          "assistant",
          error instanceof Error ? error.message : tr("The proposal could not be applied.", "Impossibile applicare la proposta."),
          true,
        ),
      ]);
    } finally {
      setApplying(false);
    }
  };

  const configured = settings?.configured === true;
  const modelOptions = settings?.supportedModels?.length
    ? settings.supportedModels
    : Object.keys(MODEL_LABELS);

  return (
    <div className="ai-assistant-page" data-ai-assistant-edition="oss">
      <section className="ai-assistant-overview" aria-labelledby="oss-ai-usage-title">
        <div className="ai-assistant-overview-copy">
          <p className="ai-assistant-kicker">{tr("Self-hosted assistant", "Assistente self-hosted")}</p>
          <h2 id="oss-ai-usage-title">{tr("Usage and working session", "Uso e sessione di lavoro")}</h2>
          <p>{tr(
            "OrbitPage does not add a request limit. Usage and billing follow the API provider connected to this server.",
            "OrbitPage non aggiunge un limite di richieste. Utilizzo e costi seguono il provider API collegato a questo server.",
          )}</p>
        </div>
        <div className="ai-assistant-usage">
          <div>
            <span>{tr("OrbitPage usage", "Utilizzo OrbitPage")}</span>
            <strong>{tr("Unmetered", "Senza limite")}</strong>
          </div>
          <div>
            <span>{tr("Remaining allowance", "Utilizzo rimanente")}</span>
            <strong>{tr("Provider-managed", "Gestito dal provider")}</strong>
          </div>
          <div>
            <span>{tr("Active model", "Modello attivo")}</span>
            <strong>{MODEL_LABELS[selectedModel]?.name || selectedModel}</strong>
          </div>
        </div>
        <div className="ai-assistant-progress is-unmetered"><span /></div>
        <p className="ai-assistant-reset">{tr(
          "API costs and provider quotas remain in your OpenAI account.",
          "Costi API e quote del provider restano nel tuo account OpenAI.",
        )}</p>
      </section>

      <div className="oss-ai-layout ai-assistant-layout">
      <section className="oss-ai-workspace ai-assistant-chat" aria-labelledby="oss-ai-heading">
        <header className="oss-ai-workspace-header">
          <div className="oss-ai-mark" aria-hidden="true">
            <Sparkles />
            <span />
          </div>
          <div>
            <p className="admin-dashboard-kicker">OrbitPage AI</p>
            <h2 id="oss-ai-heading">{tr("Edit by asking", "Modifica chiedendo")}</h2>
            <p>{tr(
              "Describe the outcome. The assistant works from this page’s current profile, content and theme.",
              "Descrivi il risultato. L’assistente lavora sul profilo, sui contenuti e sul tema attuali di questa pagina.",
            )}</p>
          </div>
          <span className={configured ? "oss-ai-status configured" : "oss-ai-status"}>
            <i aria-hidden="true" />
            {configured ? tr("Ready", "Pronta") : tr("Key required", "Chiave richiesta")}
          </span>
        </header>

        <div className="oss-ai-conversation" ref={conversationRef} aria-live="polite">
          {messages.map((message) => (
            <article
              className={`oss-ai-message ${message.role}${message.error ? " error" : ""}`}
              key={message.id}
            >
              {message.role === "assistant" && (
                <span className="oss-ai-message-icon" aria-hidden="true">
                  {message.error ? <AlertCircle /> : <Sparkles />}
                </span>
              )}
              <p>{message.content}</p>
            </article>
          ))}

          {planning && (
            <div className="oss-ai-thinking" role="status">
              <span><i /><i /><i /></span>
              {tr("Reading the page and validating a safe plan…", "Leggo la pagina e verifico un piano sicuro…")}
            </div>
          )}

          {proposal && (
            <section className="oss-ai-proposal" aria-label={tr("Proposed changes", "Modifiche proposte")}>
              <div className="oss-ai-proposal-heading">
                <ShieldCheck aria-hidden="true" />
                <div>
                  <span>{tr("Review before applying", "Controlla prima di applicare")}</span>
                  <h3>{proposal.summary}</h3>
                </div>
              </div>
              <ol>
                {proposal.changes.map((change, index) => (
                  <li key={`${index}-${change}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{change}</p>
                  </li>
                ))}
              </ol>
              <div className="oss-ai-proposal-actions">
                <Button
                  className="admin-action admin-action-primary"
                  disabled={applying}
                  onClick={() => void applyProposal()}
                  type="button"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {applying ? tr("Applying…", "Applicazione…") : tr("Apply approved changes", "Applica modifiche approvate")}
                </Button>
                <Button
                  className="admin-action"
                  disabled={applying}
                  onClick={() => setProposal(null)}
                  type="button"
                  variant="ghost"
                >
                  {tr("Discard", "Scarta")}
                </Button>
              </div>
            </section>
          )}

          {applied && (
            <div className="oss-ai-applied" role="status">
              <Check aria-hidden="true" />
              {tr("Editor data refreshed.", "Dati dell’editor aggiornati.")}
            </div>
          )}
        </div>

        <form className="oss-ai-composer" onSubmit={submitPrompt}>
          <Label className="sr-only" htmlFor="oss-ai-prompt">
            {tr("Ask OrbitPage AI", "Chiedi a OrbitPage AI")}
          </Label>
          <textarea
            id="oss-ai-prompt"
            maxLength={4000}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={configured
              ? tr("E.g. Make the page more editorial and move the booking link first…", "Es. Rendi la pagina più editoriale e sposta il link prenotazioni al primo posto…")
              : tr("Configure your OpenAI API key to start.", "Configura la tua chiave API OpenAI per iniziare.")}
            rows={3}
            value={prompt}
            disabled={!configured || planning}
          />
          <button
            aria-label={tr("Send request", "Invia richiesta")}
            disabled={!configured || planning || !prompt.trim()}
            type="submit"
          >
            {planning ? <Loader2 className="animate-spin" /> : <Send />}
          </button>
          <p>
            <ShieldCheck aria-hidden="true" />
            {tr("Nothing changes without your confirmation.", "Nessuna modifica senza la tua conferma.")}
          </p>
        </form>
      </section>

      <aside className="oss-ai-settings ai-assistant-aside" aria-labelledby="oss-ai-settings-heading">
        <div className="oss-ai-settings-title">
          <span><KeyRound aria-hidden="true" /></span>
          <div>
            <p>{tr("Your provider", "Il tuo provider")}</p>
            <h2 id="oss-ai-settings-heading">OpenAI API</h2>
          </div>
        </div>
        <p className="oss-ai-settings-copy">{tr(
          "Usage is billed directly to your OpenAI account. OrbitPage never sends the key back to the browser after saving it.",
          "L’utilizzo viene addebitato direttamente al tuo account OpenAI. Dopo il salvataggio OrbitPage non restituisce mai la chiave al browser.",
        )}</p>

        {settings === null && !settingsError ? (
          <div className="oss-ai-settings-loading"><Loader2 className="animate-spin" />{tr("Checking configuration…", "Verifica configurazione…")}</div>
        ) : (
          <>
            <div className="oss-ai-key-state">
              <span className={configured ? "configured" : ""}><i /></span>
              <div>
                <strong>{configured ? tr("Key connected", "Chiave collegata") : tr("No key connected", "Nessuna chiave collegata")}</strong>
                <small>{settings?.keyHint || tr("Stored only on this server", "Salvata solo su questo server")}</small>
              </div>
              {settings?.source && (
                <em>{settings.source === "environment" ? "ENV" : tr("Saved", "Salvata")}</em>
              )}
            </div>

            {canManageSettings ? (
              <form
                className="oss-ai-settings-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveSettings();
                }}
              >
                <div>
                  <Label htmlFor="oss-openai-key">OpenAI API key</Label>
                  <div className="oss-ai-key-input">
                    <Input
                      autoCapitalize="none"
                      autoComplete="new-password"
                      id="oss-openai-key"
                      name="openai-api-key"
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={configured ? tr("Paste to replace the current key", "Incolla per sostituire la chiave attuale") : "sk-proj-…"}
                      spellCheck={false}
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                    />
                    <button
                      aria-label={showKey ? tr("Hide key", "Nascondi chiave") : tr("Show key", "Mostra chiave")}
                      onClick={() => setShowKey((current) => !current)}
                      type="button"
                    >
                      {showKey ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="oss-openai-model">{tr("Model", "Modello")}</Label>
                  <select
                    id="oss-openai-model"
                    onChange={(event) => setSelectedModel(event.target.value)}
                    value={selectedModel}
                  >
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>
                        {MODEL_LABELS[model]?.name || model} · {MODEL_LABELS[model]?.detail || ""}
                      </option>
                    ))}
                  </select>
                </div>

                {!settings?.canStoreSecurely && (
                  <div className="oss-ai-settings-warning">
                    <AlertCircle aria-hidden="true" />
                    <p>{tr(
                      "Set a stable JWT_SECRET (32+ characters) on the server before saving the key.",
                      "Imposta sul server un JWT_SECRET stabile (almeno 32 caratteri) prima di salvare la chiave.",
                    )}</p>
                  </div>
                )}

                {settingsError && (
                  <div className="oss-ai-settings-error" role="alert">
                    <AlertCircle aria-hidden="true" />
                    <p>{settingsError}</p>
                  </div>
                )}

                <div className="oss-ai-settings-actions">
                  <Button
                    className="admin-action admin-action-primary"
                    disabled={savingSettings || !settings?.canStoreSecurely || (!apiKey.trim() && selectedModel === settings?.model)}
                    type="submit"
                  >
                    {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : settingsSaved ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {savingSettings ? tr("Saving…", "Salvataggio…") : settingsSaved ? tr("Saved", "Salvato") : tr("Save configuration", "Salva configurazione")}
                  </Button>
                  {settings?.source === "stored" && (
                    <Button
                      aria-label={tr("Remove saved API key", "Rimuovi chiave API salvata")}
                      className="admin-action oss-ai-remove-key"
                      disabled={savingSettings}
                      onClick={() => void removeStoredKey()}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    )}
                </div>
              </form>
            ) : (
              <p className="oss-ai-settings-readonly">
                <ShieldCheck aria-hidden="true" />
                {tr("Only an administrator can change the provider key.", "Solo un amministratore può cambiare la chiave del provider.")}
              </p>
            )}
          </>
        )}

        <footer>
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>{tr("Encrypted at rest", "Cifrata a riposo")}</strong>
            <span>{tr("AES-256-GCM · excluded from backups", "AES-256-GCM · esclusa dai backup")}</span>
          </p>
        </footer>
      </aside>
      </div>
    </div>
  );
}
