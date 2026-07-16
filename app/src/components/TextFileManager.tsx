import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TextFileConfig, textFilesApi } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";

type SaveState = "idle" | "loading" | "saving" | "success" | "error";

interface TextFileManagerProps {
  readOnly?: boolean;
}

export function TextFileManager({ readOnly = false }: TextFileManagerProps) {
  const [files, setFiles] = useState<TextFileConfig[]>([]);
  const [activeKey, setActiveKey] = useState<TextFileConfig["key"]>("robots");
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<SaveState>("loading");
  const [message, setMessage] = useState("");

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
    setState("idle");
  };

  const save = async () => {
    if (!activeFile || readOnly) return;
    setState("saving");
    setMessage("");
    try {
      await textFilesApi.update(activeFile.key, draft);
      setFiles((current) => current.map((file) => (
        file.key === activeFile.key
          ? { ...file, content: draft.endsWith("\n") ? draft : `${draft}\n`, isCustomized: true, updatedAt: new Date().toISOString() }
          : file
      )));
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
      setFiles((current) => current.map((file) => (
        file.key === activeFile.key
          ? { ...file, content: file.defaultContent, isCustomized: false, updatedAt: null }
          : file
      )));
      setDraft(activeFile.defaultContent);
      setState("success");
      setMessage(`${activeFile.label} reset to default.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : `Failed to reset ${activeFile.label}.`);
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
            <h2 className="text-base font-semibold text-slate-950">TXT files</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Manage crawler, LLM, security, and attribution text endpoints.
            </p>
          </div>
        </div>
        {readOnly && (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            Demo read-only
          </span>
        )}
      </div>

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
                {file.isCustomized && <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Custom</span>}
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
                href={withBasePath(activeFile.path)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
              >
                Open
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
              {dirty ? "Unsaved changes" : activeFile?.isCustomized ? "Custom content active" : "Default content active"}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                aria-busy={state === "saving"}
                type="button"
                variant="outline"
                className="admin-action"
                onClick={resetToDefault}
                disabled={busy || readOnly || !activeFile?.isCustomized}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                type="button"
                className="admin-action admin-action-primary"
                onClick={save}
                disabled={busy || readOnly || !dirty}
              >
                {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {state === "saving" ? "Saving file" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
