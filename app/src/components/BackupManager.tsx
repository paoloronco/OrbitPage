import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { backupApi, uploadApi } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import {
  MAX_HOSTED_BACKUP_FILE_BYTES,
  MAX_MANAGED_BACKUP_PAYLOAD_BYTES,
  prepareHostedRestoreBackup,
  type HostedBackupMedia,
} from "@/lib/hosted-backup-import";
import { formatFileSize, optimizeImageForUpload } from "@/lib/image-upload";

type BackupState = "idle" | "exporting" | "restoring" | "success" | "error";

interface BackupManagerProps {
  hosted?: boolean;
}

function mediaFileFromBackup(media: HostedBackupMedia) {
  let binary: string;
  try {
    binary = window.atob(media.base64);
  } catch {
    throw new Error(`The embedded media file ${media.fileName} is not valid Base64 data.`);
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], media.fileName, { type: media.mimeType });
}

export function BackupManager({ hosted = false }: BackupManagerProps) {
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

    if (hosted && file.size > MAX_HOSTED_BACKUP_FILE_BYTES) {
      setState("error");
      setMessage(`This backup is too large. The maximum import size is ${formatFileSize(MAX_HOSTED_BACKUP_FILE_BYTES)}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (DEMO_MODE) {
      setState("error");
      setMessage("Backup restore is disabled in demo mode.");
      return;
    }

    const confirmed = window.confirm(
      hosted
        ? "Restore this page backup? The current profile, blocks, theme, and privacy settings will be replaced. For self-hosted backups, only referenced page media is migrated; users, passwords, and unused uploads are ignored."
        : "Restore this backup? Current data and uploads will be replaced."
    );
    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setState("restoring");
    setMessage(hosted ? "Reading and validating the backup..." : "Restoring backup...");

    try {
      const backup = JSON.parse(await file.text());
      if (!hosted) {
        await backupApi.restore(backup);
        setState("success");
        setMessage("Backup restored. Reloading...");
        window.setTimeout(() => window.location.reload(), 800);
        return;
      }

      let uploadQueue = Promise.resolve();
      let uploadCount = 0;
      const uploadMedia = (media: HostedBackupMedia) => {
        const task = uploadQueue.then(async () => {
          uploadCount += 1;
          setMessage(`Migrating referenced media ${uploadCount}: ${media.fileName}`);
          const sourceFile = mediaFileFromBackup(media);

          if (media.mimeType.startsWith("video/")) {
            if (media.purpose === "background") {
              return uploadApi.uploadBackgroundMedia(sourceFile, media.slot).then((result) => result.filePath);
            }
            return uploadApi.uploadVideo(sourceFile, media.slot, (percentage) => {
              setMessage(`Migrating ${media.fileName}: ${percentage}%`);
            }).then((result) => result.filePath);
          }

          const variant = media.purpose === "profile" ? "profile" : media.purpose === "icon" ? "icon" : "cover";
          const uploadFile = sourceFile.size > 2 * 1024 * 1024
            ? await optimizeImageForUpload(sourceFile, variant)
            : sourceFile;
          return uploadApi.uploadImage(uploadFile, media.slot).then((result) => result.filePath);
        });
        uploadQueue = task.then(() => undefined, () => undefined);
        return task;
      };

      const prepared = await prepareHostedRestoreBackup(backup, uploadMedia);
      setMessage("Saving the restored page...");
      const payload = JSON.stringify(prepared.backup);
      const payloadBytes = new TextEncoder().encode(payload).byteLength;
      if (payloadBytes > MAX_MANAGED_BACKUP_PAYLOAD_BYTES) {
        throw new Error(
          `The converted page data is ${formatFileSize(payloadBytes)}. The maximum is ${formatFileSize(MAX_MANAGED_BACKUP_PAYLOAD_BYTES)} after media migration.`,
        );
      }
      await backupApi.restore(prepared.backup);
      setState("success");
      const mediaSummary = prepared.source === "self-hosted"
        ? ` ${prepared.migratedMedia} referenced media imported; ${prepared.skippedUploads} unused uploads skipped.`
        : "";
      setMessage(`Backup restored.${mediaSummary} Reloading...`);
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
              {hosted
                ? "Export this managed page or import a managed/Self-hosted OrbitPage backup. Referenced page media is migrated to managed storage; accounts, passwords, billing, and unused uploads are never imported."
                : "Export database records and uploaded media, or restore a saved JSON backup."}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            state === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : state === "restoring" || state === "exporting"
                ? "border-sky-200 bg-sky-50 text-sky-800"
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
          aria-busy={state === "exporting"}
        >
          {state === "exporting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {state === "exporting" ? "Exporting" : "Download backup"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="admin-action"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || DEMO_MODE}
          aria-busy={state === "restoring"}
        >
          {state === "restoring" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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
