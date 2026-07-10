import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { backupApi } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";

type BackupState = "idle" | "exporting" | "restoring" | "success" | "error";

export function BackupManager() {
  const [state, setState] = useState<BackupState>("idle");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = state === "exporting" || state === "restoring";

  const downloadBackup = async () => {
    setState("exporting");
    setMessage("");

    try {
      const blob = await backupApi.download();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orbitpage-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setState("success");
      setMessage("Backup downloaded.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Backup export failed.");
    }
  };

  const restoreBackup = async (file?: File) => {
    if (!file) return;

    if (DEMO_MODE) {
      setState("error");
      setMessage("Backup restore is disabled in demo mode.");
      return;
    }

    const confirmed = window.confirm("Restore this backup? Current data and uploads will be replaced.");
    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setState("restoring");
    setMessage("");

    try {
      const backup = JSON.parse(await file.text());
      await backupApi.restore(backup);
      setState("success");
      setMessage("Backup restored. Reloading...");
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Backup restore failed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card className={`glass-card p-6 space-y-5 ${DEMO_MODE ? "opacity-70" : ""}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold">Backup & Restore</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Export database records and uploaded media, or restore a saved JSON backup.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            state === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {state === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
          <span>{message}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          className="admin-action admin-action-primary"
          onClick={downloadBackup}
          disabled={busy}
        >
          <Download className="h-4 w-4" />
          {state === "exporting" ? "Exporting" : "Download backup"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="admin-action"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || DEMO_MODE}
        >
          <Upload className="h-4 w-4" />
          {state === "restoring" ? "Restoring" : "Restore backup"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void restoreBackup(event.target.files?.[0])}
        />
      </div>
    </Card>
  );
}
