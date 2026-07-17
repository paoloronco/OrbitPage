import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FilePlus2, FileText, Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TextFileConfig, textFilesApi } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { useAppI18n } from "@/lib/i18n";

type SaveState = "idle" | "loading" | "saving" | "success" | "error";

interface TextFileManagerProps {
  readOnly?: boolean;
}

export function TextFileManager({ readOnly = false }: TextFileManagerProps) {
  const { tr } = useAppI18n();
  const [files, setFiles] = useState<TextFileConfig[]>([]);
  const [activeKey, setActiveKey] = useState<TextFileConfig["key"]>("robots");
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<SaveState>("loading");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeFile = useMemo(
    () => files.find((file) => file.key === activeKey) || files[0],
    [activeKey, files]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState("loading");
      setMessage("");
      try {
        const response = await textFilesApi.get();
        if (cancelled) return;
        const nextFiles = response.data.files;
        setFiles(nextFiles);
        const selected = nextFiles.find((file) => file.key === activeKey) || nextFiles[0];
        if (selected) {
          setActiveKey(selected.key);
          setDraft(selected.content);
        }
        setState("idle");
      } catch (error) {
        if (cancelled) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Failed to load TXT files.");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectFile = (file: TextFileConfig) => {
    setActiveKey(file.key);
    setDraft(file.content);
    setMessage("");
    setConfirmDelete(false);
    setState("idle");
  };

  const createFile = async () => {
    if (readOnly || !newPath.trim()) return;
    setState("saving");
    setMessage("");
    try {
      const response = await textFilesApi.create(newPath.trim());
      const file = response.data;
      setFiles((current) => [...current, file]);
      setActiveKey(file.key);
      setDraft(file.content);
      setNewPath("");
      setCreating(false);
      setState("success");
      setMessage(`${file.label} created.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Failed to create the TXT file.");
    }
  };

  const save = async () => {
    if (!activeFile || readOnly) return;
    setState("saving");
    setMessage("");
    try {
      await textFilesApi.update(activeFile.key, draft);
      const normalizedDraft = draft.endsWith("\n") ? draft : `${draft}\n`;
      setFiles((current) => current.map((file) => (
        file.key === activeFile.key
          ? { ...file, content: normalizedDraft, isCustomized: true, updatedAt: new Date().toISOString() }
          : file
      )));
      setDraft(normalizedDraft);
      setState("success");
      setMessage(`${activeFile.label} saved.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : `Failed to save ${activeFile.label}.`);
    }
  };

  const resetToDefault = async () => {
    if (!activeFile || readOnly) return;
    setState("saving");
    setMessage("");
    try {
      await textFilesApi.reset(activeFile.key);
      if (activeFile.isCustom) {
        const remaining = files.filter((file) => file.key !== activeFile.key);
        const selected = remaining.find((file) => file.key === "robots") || remaining[0];
        setFiles(remaining);
        if (selected) {
          setActiveKey(selected.key);
          setDraft(selected.content);
        }
      } else {
        const defaultContent = activeFile.defaultContent || "";
        setFiles((current) => current.map((file) => (
          file.key === activeFile.key
            ? { ...file, content: defaultContent, isCustomized: false, updatedAt: null }
            : file
        )));
        setDraft(defaultContent);
      }
      setState("success");
      setConfirmDelete(false);
      setMessage(activeFile.isCustom ? `${activeFile.label} deleted.` : `${activeFile.label} reset to default.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : `Failed to update ${activeFile.label}.`);
    }
  };

  const busy = state === "loading" || state === "saving";
  const dirty = Boolean(activeFile && draft !== activeFile.content);

  return (
    <Card className="admin-panel space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="admin-panel-icon">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">{tr("TXT files", "File TXT")}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {tr("Manage crawler, LLM, security, and attribution text endpoints.", "Gestisci gli endpoint testuali per crawler, LLM, sicurezza e attribuzione.")}
            </p>
          </div>
        </div>
        {readOnly ? (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            {tr("Demo read-only", "Demo in sola lettura")}
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="admin-action"
            onClick={() => {
              setCreating((current) => !current);
              setMessage("");
            }}
            disabled={busy}
          >
            {creating ? <X className="h-4 w-4" /> : <FilePlus2 className="h-4 w-4" />}
            {creating ? tr("Cancel", "Annulla") : tr("Add TXT file", "Aggiungi file TXT")}
          </Button>
        )}
      </div>

      {creating && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
              {tr("Public TXT path", "Percorso TXT pubblico")}
              <Input
                value={newPath}
                onChange={(event) => setNewPath(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createFile();
                  }
                }}
                placeholder="ads.txt"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                className="mt-2 bg-white font-mono"
              />
            </label>
            <Button
              type="button"
              className="admin-action admin-action-primary"
              onClick={() => void createFile()}
              disabled={busy || !newPath.trim()}
            >
              {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin [animation-duration:1.2s]" /> : <Plus className="h-4 w-4" />}
              {tr("Create file", "Crea file")}
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            {tr("Use", "Usa")} <span className="font-mono">name.txt</span> {tr("or", "oppure")} <span className="font-mono">.well-known/name.txt</span>. {tr("OrbitPage keeps system paths unique and allows up to 20 custom files.", "OrbitPage mantiene univoci i percorsi di sistema e consente fino a 20 file personalizzati.")}
          </p>
        </div>
      )}

      {message && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
          state === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {state === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
          <span>{message}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          {files.map((file) => (
            <button
              key={file.key}
              type="button"
              onClick={() => selectFile(file)}
              className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                activeFile?.key === file.key
                  ? "border-blue-300 bg-blue-50 text-blue-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold">{file.label}</span>
                {file.isCustom ? (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{tr("Added", "Aggiunto")}</span>
                ) : file.isCustomized ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{tr("Edited", "Modificato")}</span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{file.description}</span>
            </button>
          ))}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-sm font-semibold text-slate-950">{activeFile?.path || "/robots.txt"}</p>
              {activeFile?.aliases?.length ? (
                <p className="mt-1 text-xs text-slate-500">Alias: {activeFile.aliases.join(", ")}</p>
              ) : null}
            </div>
            {activeFile && (
              <a
                href={activeFile.publicUrl || withBasePath(activeFile.path)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                {tr("Open", "Apri")}
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            disabled={busy || readOnly}
            className="min-h-[360px] resize-y font-mono text-xs leading-5"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {dirty ? tr("Unsaved changes", "Modifiche non salvate") : activeFile?.isCustom ? tr("Custom TXT file active", "File TXT personalizzato attivo") : activeFile?.isCustomized ? tr("Edited content active", "Contenuto modificato attivo") : tr("Default content active", "Contenuto predefinito attivo")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {activeFile?.isCustom && confirmDelete ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="admin-action" onClick={() => setConfirmDelete(false)} disabled={busy}>
                    <X className="h-4 w-4" />
                    {tr("Cancel", "Annulla")}
                  </Button>
                  <Button type="button" variant="destructive" className="admin-action" onClick={() => void resetToDefault()} disabled={busy || readOnly}>
                    <Trash2 className="h-4 w-4" />
                    {tr("Confirm delete", "Conferma eliminazione")}
                  </Button>
                </div>
              ) : (
                <Button
                  aria-busy={state === "saving"}
                  type="button"
                  variant="outline"
                  className="admin-action"
                  onClick={() => activeFile?.isCustom ? setConfirmDelete(true) : void resetToDefault()}
                  disabled={busy || readOnly || (!activeFile?.isCustom && !activeFile?.isCustomized)}
                >
                  {activeFile?.isCustom ? <Trash2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  {activeFile?.isCustom ? tr("Delete file", "Elimina file") : tr("Reset", "Ripristina")}
                </Button>
              )}
              <Button
                type="button"
                className="admin-action admin-action-primary"
                onClick={save}
                disabled={busy || readOnly || !dirty}
              >
                {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin [animation-duration:1.2s]" /> : <Save className="h-4 w-4" />}
                {state === "saving" ? tr("Saving file", "Salvataggio file") : tr("Save", "Salva")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
