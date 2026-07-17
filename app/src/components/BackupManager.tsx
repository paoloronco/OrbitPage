import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { backupApi, uploadApi } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import {
  BACKUP_SECTION_IDS,
  MANAGED_BACKUP_SECTION_IDS,
  MAX_HOSTED_BACKUP_FILE_BYTES,
  MAX_MANAGED_BACKUP_PAYLOAD_BYTES,
  inspectOrbitPageBackup,
  prepareHostedRestoreBackup,
  type BackupSectionId,
  type HostedBackupMedia,
  type OrbitPageBackupInspection,
} from "@/lib/hosted-backup-import";
import { formatFileSize, optimizeImageForUpload } from "@/lib/image-upload";
import { useAppI18n } from "@/lib/i18n";

type BackupState = "idle" | "exporting" | "restoring" | "success" | "error";

interface BackupManagerProps {
  hosted?: boolean;
}

type PendingRestore = {
  backup: unknown;
  fileName: string;
  inspection: OrbitPageBackupInspection;
  availableSections: BackupSectionId[];
  selectedSections: BackupSectionId[];
};

const SECTION_COPY: Record<BackupSectionId, { label: string; description: string }> = {
  profile: { label: "Profile & page", description: "Name, bio, social links and page metadata" },
  links: { label: "Blocks & links", description: "Content, order, scheduling and block settings" },
  theme: { label: "Theme & appearance", description: "Colors, typography, cards and background" },
  menu: { label: "Venue menu", description: "Menu identity, sections, products and appearance" },
  privacy: { label: "Privacy & consent", description: "Cookie banner and consent preferences" },
  discovery: { label: "Discovery files", description: "robots.txt, llms.txt, custom TXT files and sitemap state" },
  accounts: { label: "Admin accounts", description: "Self-hosted users, roles and credentials" },
  media: { label: "Uploaded media", description: "Images, video and other uploaded assets" },
};

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

function SectionSelector({
  sections,
  selected,
  onChange,
  idPrefix,
  disabled = false,
}: {
  sections: readonly BackupSectionId[];
  selected: readonly BackupSectionId[];
  onChange: (sections: BackupSectionId[]) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const { tr } = useAppI18n();
  const toggle = (section: BackupSectionId, checked: boolean) => {
    onChange(checked
      ? sections.filter((candidate) => candidate === section || selected.includes(candidate))
      : selected.filter((candidate) => candidate !== section));
  };

  return (
    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {sections.map((section) => {
        const sourceCopy = SECTION_COPY[section];
        const translated: Record<BackupSectionId, { label: string; description: string }> = {
          profile: { label: tr("Profile & page", "Profilo e pagina"), description: tr("Name, bio, social links and page metadata", "Nome, bio, link social e metadati della pagina") },
          links: { label: tr("Blocks & links", "Blocchi e link"), description: tr("Content, order, scheduling and block settings", "Contenuti, ordine, programmazione e impostazioni dei blocchi") },
          theme: { label: tr("Theme & appearance", "Tema e aspetto"), description: tr("Colors, typography, cards and background", "Colori, tipografia, card e sfondo") },
          menu: { label: tr("Venue menu", "Menu del locale"), description: tr("Menu identity, sections, products and appearance", "Identità, sezioni, prodotti e aspetto del menu") },
          privacy: { label: tr("Privacy & consent", "Privacy e consenso"), description: tr("Cookie banner and consent preferences", "Banner cookie e preferenze del consenso") },
          discovery: { label: tr("Discovery files", "File di indicizzazione"), description: tr("robots.txt, llms.txt, custom TXT files and sitemap state", "robots.txt, llms.txt, file TXT personalizzati e stato sitemap") },
          accounts: { label: tr("Admin accounts", "Account amministratori"), description: tr("Self-hosted users, roles and credentials", "Utenti self-hosted, ruoli e credenziali") },
          media: { label: tr("Uploaded media", "Media caricati"), description: tr("Images, video and other uploaded assets", "Immagini, video e altre risorse caricate") },
        };
        const copy = translated[section] || sourceCopy;
        const id = `${idPrefix}-backup-section-${section}`;
        return (
          <label key={section} htmlFor={id} className="flex cursor-pointer items-start gap-3 py-1">
            <Checkbox
              id={id}
              className="mt-0.5"
              checked={selected.includes(section)}
              onCheckedChange={(checked) => toggle(section, checked === true)}
              disabled={disabled}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{copy.label}</span>
              <span className="block text-xs leading-5 text-muted-foreground">{copy.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function BackupManager({ hosted = false }: BackupManagerProps) {
  const { tr } = useAppI18n();
  const exportableSections = hosted
    ? [...MANAGED_BACKUP_SECTION_IDS]
    : [...BACKUP_SECTION_IDS];
  const [state, setState] = useState<BackupState>("idle");
  const [message, setMessage] = useState("");
  const [exportSections, setExportSections] = useState<BackupSectionId[]>(exportableSections);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = state === "exporting" || state === "restoring";

  const downloadBackup = async () => {
    if (exportSections.length === 0) {
      setState("error");
      setMessage("Select at least one section to export.");
      return;
    }
    setState("exporting");
    setMessage("");

    try {
      const blob = await backupApi.download(exportSections);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orbitpage-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setState("success");
      setMessage(`Backup downloaded with ${exportSections.length} selected section${exportSections.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Backup export failed.");
    }
  };

  const readBackupFile = async (file?: File) => {
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

    setState("idle");
    setMessage("");
    try {
      const backup = JSON.parse(await file.text());
      const inspection = inspectOrbitPageBackup(backup);
      if (!hosted && inspection.source !== "self-hosted") {
        throw new Error("Managed-page backups can only be restored from the hosted OrbitPage dashboard.");
      }
      const allowedSections = hosted
        ? [...MANAGED_BACKUP_SECTION_IDS, ...(inspection.source === "self-hosted" ? ["media" as const] : [])]
        : [...BACKUP_SECTION_IDS];
      const availableSections = allowedSections.filter((section) => inspection.sections.includes(section));
      if (availableSections.length === 0) throw new Error("This backup contains no sections that can be restored here.");
      setPendingRestore({
        backup,
        fileName: file.name,
        inspection,
        availableSections,
        selectedSections: availableSections,
      });
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The backup file could not be read.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const cancelRestore = () => {
    setPendingRestore(null);
    setState("idle");
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const restoreBackup = async () => {
    if (!pendingRestore) return;
    const selected = pendingRestore.selectedSections;
    const selectedPageSections = selected.filter((section) => MANAGED_BACKUP_SECTION_IDS.includes(
      section as typeof MANAGED_BACKUP_SECTION_IDS[number],
    ));
    if (selected.length === 0 || (hosted && selectedPageSections.length === 0)) {
      setState("error");
      setMessage(hosted ? "Select at least one page section to restore." : "Select at least one section to restore.");
      return;
    }

    const labels = selected.map((section) => SECTION_COPY[section].label).join(", ");
    const accountWarning = selected.includes("accounts")
      ? " Restoring admin accounts can sign out the current self-hosted administrator."
      : "";
    if (!window.confirm(`Restore only these sections: ${labels}? Other current sections will remain unchanged.${accountWarning}`)) {
      return;
    }

    setState("restoring");
    setMessage(hosted ? "Preparing the selected sections..." : "Restoring the selected sections...");

    try {
      if (!hosted) {
        await backupApi.restore(pendingRestore.backup, selected);
        setState("success");
        setMessage("Selected sections restored. Reloading...");
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

      const prepared = await prepareHostedRestoreBackup(pendingRestore.backup, uploadMedia, selected);
      setMessage("Saving the selected page sections...");
      const payload = JSON.stringify(prepared.backup);
      const payloadBytes = new TextEncoder().encode(payload).byteLength;
      if (payloadBytes > MAX_MANAGED_BACKUP_PAYLOAD_BYTES) {
        throw new Error(
          `The converted page data is ${formatFileSize(payloadBytes)}. The maximum is ${formatFileSize(MAX_MANAGED_BACKUP_PAYLOAD_BYTES)} after media migration.`,
        );
      }
      await backupApi.restore(prepared.backup);
      setState("success");
      setPendingRestore(null);
      const mediaSummary = prepared.source === "self-hosted"
        ? ` ${prepared.migratedMedia} referenced media imported; ${prepared.skippedUploads} unselected or unused uploads skipped.`
        : "";
      setMessage(`Selected sections restored.${mediaSummary} Reloading...`);
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Backup restore failed.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card className={`glass-card space-y-6 p-6 ${DEMO_MODE ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Database className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold">{tr("Backup & Restore", "Backup e ripristino")}</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {hosted
              ? tr("Choose exactly which managed-page sections to export or restore. Self-hosted backups can migrate referenced page media, while accounts, passwords, billing and internal files stay excluded.", "Scegli esattamente quali sezioni della pagina gestita esportare o ripristinare. I backup self-hosted possono trasferire i media usati dalla pagina; account, password, fatturazione e file interni restano esclusi.")
              : tr("Choose which database sections and uploaded media to export or restore. Sections left unchecked remain unchanged.", "Scegli quali sezioni del database e media esportare o ripristinare. Le sezioni non selezionate restano invariate.")}
          </p>
        </div>
      </div>

      {message && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
          state === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : state === "restoring" || state === "exporting"
              ? "border-sky-200 bg-sky-50 text-sky-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {state === "error"
            ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            : state === "restoring" || state === "exporting"
              ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin [animation-duration:1.2s]" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      <section className="space-y-4" aria-labelledby="backup-export-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 id="backup-export-heading" className="text-sm font-semibold">Export</h4>
            <p className="text-xs leading-5 text-muted-foreground">{tr("The downloaded file contains only the checked sections.", "Il file scaricato contiene solo le sezioni selezionate.")}</p>
          </div>
          <div className="flex gap-3 text-xs">
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setExportSections(exportableSections)} disabled={busy}>{tr("Select all", "Seleziona tutto")}</button>
            <button type="button" className="font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => setExportSections([])} disabled={busy}>{tr("Clear", "Deseleziona")}</button>
          </div>
        </div>
        <SectionSelector idPrefix="export" sections={exportableSections} selected={exportSections} onChange={setExportSections} disabled={busy} />
        <Button
          type="button"
          className="admin-action admin-action-primary"
          onClick={downloadBackup}
          disabled={busy || exportSections.length === 0}
          aria-busy={state === "exporting"}
        >
          {state === "exporting" ? <Loader2 className="h-4 w-4 animate-spin [animation-duration:1.2s]" /> : <Download className="h-4 w-4" />}
          {state === "exporting" ? tr("Exporting", "Esportazione") : tr("Download selected", "Scarica selezione")}
        </Button>
      </section>

      <section className="space-y-4 border-t border-border/70 pt-5" aria-labelledby="backup-import-heading">
        <div>
          <h4 id="backup-import-heading" className="text-sm font-semibold">{tr("Restore", "Ripristina")}</h4>
          <p className="text-xs leading-5 text-muted-foreground">{tr("Open a backup first, then choose which of its available sections to apply.", "Apri prima un backup, poi scegli quali sezioni disponibili applicare.")}</p>
        </div>

        {pendingRestore ? (
          <div className="space-y-4 rounded-md border border-border bg-background/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{pendingRestore.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {pendingRestore.inspection.source === "managed" ? tr("Managed page backup", "Backup pagina gestita") : tr("Self-hosted OrbitPage backup", "Backup OrbitPage self-hosted")}
                </p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={cancelRestore} disabled={busy} title={tr("Close backup", "Chiudi backup")}>
                <X className="h-4 w-4" />
                <span className="sr-only">{tr("Close backup", "Chiudi backup")}</span>
              </Button>
            </div>
            <SectionSelector
              idPrefix="restore"
              sections={pendingRestore.availableSections}
              selected={pendingRestore.selectedSections}
              onChange={(selectedSections) => setPendingRestore((current) => current ? { ...current, selectedSections } : current)}
              disabled={busy}
            />
            {hosted && pendingRestore.inspection.source === "self-hosted" && pendingRestore.availableSections.includes("media") && (
              <p className="text-xs leading-5 text-muted-foreground">
                {tr("Keep Uploaded media selected when restored profile, blocks or theme settings reference local self-hosted files.", "Mantieni selezionato Media caricati quando profilo, blocchi o tema ripristinati fanno riferimento a file self-hosted locali.")}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="admin-action admin-action-primary" onClick={() => void restoreBackup()} disabled={busy || pendingRestore.selectedSections.length === 0}>
                {state === "restoring" ? <Loader2 className="h-4 w-4 animate-spin [animation-duration:1.2s]" /> : <Upload className="h-4 w-4" />}
                {state === "restoring" ? tr("Restoring", "Ripristino") : tr("Restore selected", "Ripristina selezione")}
              </Button>
              <Button type="button" variant="outline" className="admin-action" onClick={cancelRestore} disabled={busy}>{tr("Cancel", "Annulla")}</Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="admin-action"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || DEMO_MODE}
          >
            <Upload className="h-4 w-4" />
            {tr("Open backup file", "Apri file di backup")}
          </Button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void readBackupFile(event.target.files?.[0])}
        />
      </section>
    </Card>
  );
}
