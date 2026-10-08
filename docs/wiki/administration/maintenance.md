# Backups and maintenance

Use this guide for a complete data backup, restore, rollback, or removal. For installation and update commands, see [Deployment](./Deployment.md). For dashboard exports and local version history, see [Backups and media](../dashboard/sections/backups-and-demo-mode.md).

| Task | Procedure |
| --- | --- |
| Create an archive | [Backup](#create-and-verify-an-infrastructure-backup) |
| Recover an instance | [Restore](#restore-an-infrastructure-backup) |
| Check a changed installation | [Verification](#post-change-health-and-smoke-test) |
| Undo an update | [Rollback](#roll-back-an-update) |
| Remove OrbitPage | [Uninstall](#uninstall-or-purge) |
| Back up a Proxmox guest | [Proxmox](#proxmox-backup-and-restore) |

## Persistent data and backup types

Back up the whole `DATA_DIR` (`/app/data` in Docker): SQLite and its sidecars, `uploads/`, private `shop-files/`, the generated `.jwt-secret`, and saved `.instance-env.json` overrides. Include host-managed secrets and configuration separately. Shop credentials and delivery links require the original encryption/signing secrets after restore; see [Shop recovery](../dashboard/sections/shop.md#storage-backup-and-updates).

There are two distinct backup types:

| Backup | Use | Limit |
| --- | --- | --- |
| Dashboard JSON export | Move or selectively restore application content | Not an infrastructure disaster-recovery backup |
| `orbitpage backup` archive | Restore the installed app, database, uploads, Compose definition, and secret file | Contains secrets; protect and encrypt it |

The management command stops a running OrbitPage container before creating the archive, then restarts it. This gives SQLite and its sidecars a consistent application-level snapshot.

## Create and verify an infrastructure backup

The numbered procedure uses the Linux installer. Run its steps in the same Bash shell and stop if a check fails. `orbitpage` has no restore command.

1. Check the installation and choose an off-data destination:

   ```bash
   set -euo pipefail
   sudo orbitpage status
   sudo orbitpage config
   BACKUP="/var/backups/orbitpage/orbitpage-manual-$(date -u +%Y%m%d-%H%M%S).tar.gz"
   ```

2. Create the consistent archive:

   ```bash
   sudo orbitpage backup "$BACKUP"
   ```

3. Verify compression, required files, permissions, and checksum:

   ```bash
   DATA_DIR="$(sudo awk -F= '$1 == "ORBITPAGE_DATA_DIR" { print substr($0, index($0, "=") + 1) }' /opt/orbitpage/.env)"
   DATA_ENTRY="${DATA_DIR#/}/orbitpage.db"
   BACKUP_DIRECTORY="$(dirname "$BACKUP")"
   BACKUP_NAME="$(basename "$BACKUP")"

   sudo gzip -t "$BACKUP"
   sudo tar -tzf "$BACKUP" | grep -Fx 'etc/orbitpage/orbitpage.env' >/dev/null
   sudo tar -tzf "$BACKUP" | grep -Fx 'opt/orbitpage/compose.yaml' >/dev/null
   sudo tar -tzf "$BACKUP" | grep -Fx "$DATA_ENTRY" >/dev/null
   test "$(sudo stat -c '%a' "$BACKUP")" = '600'

   sudo sha256sum "$BACKUP" |
     awk -v name="$BACKUP_NAME" '{ print $1 "  " name }' |
     sudo tee "${BACKUP}.sha256" >/dev/null
   sudo chmod 0600 "${BACKUP}.sha256"
   sudo bash -c 'cd "$1" && sha256sum -c "$2"' \
     _ "$BACKUP_DIRECTORY" "${BACKUP_NAME}.sha256"
   ```

4. Copy the archive and checksum to encrypted storage outside the application host.

5. Periodically restore a copy into an isolated VM or LXC, keep it disconnected from production DNS, and complete the [post-change smoke test](#post-change-health-and-smoke-test). Archive integrity alone does not prove that the recovery process works.

Set a backup retention period. Stop OrbitPage before copying SQLite and its sidecars.

### Manual Docker, Compose, or source installations

1. Stop the container with `docker stop orbitpage` or `docker compose stop orbitpage`; stop a source process through its service manager.
2. Copy the whole mounted data directory/volume, including hidden files and SQLite sidecars. Also copy the Compose definition, protected environment file, and any separately configured secrets.
3. Protect the copy with owner-only permissions and store it off-host. Restart the original instance and check health.
4. Test recovery into an empty data mount on an isolated instance, using the original settings and secret. Keep its network separate and verify content, login, and media.

For recovery, stop the instance and restore into an empty data location before recreating/restarting it. Keep the previous data location intact until verification succeeds; do not merge archive contents into an active database.

## Restore an infrastructure backup

This procedure replaces the current data, configuration, and installer definition. Use only an archive created by `orbitpage backup`, verify its checksum, and perform the first restore drill away from production.

### Restore in place

1. Copy the archive and its `.sha256` file to the host. Verify them before stopping the service:

   ```bash
   set -euo pipefail
   BACKUP=/var/backups/orbitpage/orbitpage-YYYYMMDD-HHMMSS.tar.gz
   BACKUP_DIRECTORY="$(dirname "$BACKUP")"
   BACKUP_NAME="$(basename "$BACKUP")"
   sudo bash -c 'cd "$1" && sha256sum -c "$2"' \
     _ "$BACKUP_DIRECTORY" "${BACKUP_NAME}.sha256"
   sudo gzip -t "$BACKUP"
   sudo tar -tzf "$BACKUP"
   ```

   Abort if the archive contains absolute paths, `..` path segments, or content outside the expected data, `/etc/orbitpage`, and `/opt/orbitpage` trees.

2. Confirm that the archived and current data directories match:

   ```bash
   ARCHIVED_DATA_DIR="$(sudo tar -xOzf "$BACKUP" opt/orbitpage/.env | awk -F= '$1 == "ORBITPAGE_DATA_DIR" { print substr($0, index($0, "=") + 1) }')"
   CURRENT_DATA_DIR="$(sudo awk -F= '$1 == "ORBITPAGE_DATA_DIR" { print substr($0, index($0, "=") + 1) }' /opt/orbitpage/.env)"
   test -n "$ARCHIVED_DATA_DIR"
   test "$ARCHIVED_DATA_DIR" = "$CURRENT_DATA_DIR"

   case "$CURRENT_DATA_DIR" in
     /|/opt/orbitpage|/opt/orbitpage/*|/etc/orbitpage|/etc/orbitpage/*|/var/backups/orbitpage|/var/backups/orbitpage/*)
       printf 'Unsafe or overlapping data directory: %s\n' "$CURRENT_DATA_DIR" >&2
       exit 1
       ;;
   esac
   [[ "$CURRENT_DATA_DIR" == /* && "${CURRENT_DATA_DIR,,}" == *orbitpage* ]]

   ARCHIVED_DATA_ROOT="${ARCHIVED_DATA_DIR#/}"
   sudo tar -tzf "$BACKUP" | awk -v data="$ARCHIVED_DATA_ROOT" '
     function unsafe(path, count, index_, parts) {
       if (substr(path, 1, 1) == "/") return 1
       count = split(path, parts, "/")
       for (index_ = 1; index_ <= count; index_++) {
         if (parts[index_] == "..") return 1
       }
       return 0
     }
     {
       path = $0
       sub(/\/$/, "", path)
       allowed = path == data || index(path, data "/") == 1 ||
         path == "etc/orbitpage" || index(path, "etc/orbitpage/") == 1 ||
         path == "opt/orbitpage" || index(path, "opt/orbitpage/") == 1
       if (unsafe(path) || !allowed) {
         print "Unexpected archive entry: " $0 > "/dev/stderr"
         bad = 1
       }
     }
     END { exit bad ? 1 : 0 }
   '
   ```

   If they differ, stop and plan a data-directory migration. Do not extract over an unrelated path.

3. Create and verify a final safety backup of the current state:

   ```bash
   SAFETY="/var/backups/orbitpage/pre-restore-$(date -u +%Y%m%d-%H%M%S).tar.gz"
   sudo orbitpage backup "$SAFETY"
   sudo gzip -t "$SAFETY"
   SAFETY_DIRECTORY="$(dirname "$SAFETY")"
   SAFETY_NAME="$(basename "$SAFETY")"
   sudo sha256sum "$SAFETY" |
     awk -v name="$SAFETY_NAME" '{ print $1 "  " name }' |
     sudo tee "${SAFETY}.sha256" >/dev/null
   sudo chmod 0600 "${SAFETY}.sha256"
   sudo bash -c 'cd "$1" && sha256sum -c "$2"' \
     _ "$SAFETY_DIRECTORY" "${SAFETY_NAME}.sha256"
   ```

4. Stop OrbitPage and move the current trees aside instead of deleting them:

   ```bash
   STAMP="$(date -u +%Y%m%d-%H%M%S)"
   sudo orbitpage stop
   sudo mv -- "$CURRENT_DATA_DIR" "${CURRENT_DATA_DIR}.before-restore-${STAMP}"
   sudo mv -- /etc/orbitpage "/etc/orbitpage.before-restore-${STAMP}"
   sudo mv -- /opt/orbitpage "/opt/orbitpage.before-restore-${STAMP}"
   ```

5. Extract the trusted archive and restore restrictive permissions:

   ```bash
   sudo tar --extract --gzip --numeric-owner --same-owner --file "$BACKUP" --directory /
   sudo chmod 0700 /etc/orbitpage
   sudo chmod 0600 /etc/orbitpage/orbitpage.env /opt/orbitpage/.env
   ```

6. For an ordinary restore, start and validate the restored instance:

   ```bash
   sudo orbitpage start
   sudo orbitpage status
   ```

   Complete the [post-change health and smoke test](#post-change-health-and-smoke-test) before removing the `.before-restore-*` trees. Keep the safety backup off-host.

   For an update rollback, do not start the restored configuration in this step. Continue at [Roll back an update](#roll-back-an-update) so the previous immutable image is selected before restored data is opened.

### Restore to a replacement host

1. Provision a supported Debian or Ubuntu host with the same architecture.
2. Install OrbitPage with the archived `ORBITPAGE_DATA_DIR` and the exact image digest used by the backup.
3. Stop the new empty instance.
4. Follow the in-place restore procedure on that host.
5. Keep production DNS and proxy traffic pointed at the old host until the replacement passes health, public-page, dashboard, login, and upload checks.

If `/usr/local/bin/orbitpage` is missing after a full-host recovery, extract the archive first, then rerun the Linux installer. It preserves the restored secret and data, repairs the CLI and Compose definition, and performs its own health check.

## Post-change health and smoke test

Use the configured address and port. The example uses installer defaults; skip `orbitpage status` for a manual container:

```bash
sudo orbitpage status
curl -fsS --max-time 10 http://127.0.0.1:8080/health
curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:8080/
curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:8080/dashboard/profile
sudo docker logs --tail 100 orbitpage
```

The health response must contain `"status":"ok"` and the expected version. Then verify through the real HTTPS origin:

1. the public page renders expected profile content and uploaded media;
2. `/dashboard/profile` loads without asset or API errors;
3. an administrator can log in;
4. a harmless edit can be saved and read back;
5. the reverse proxy returns the expected certificate and does not cache `/api/*`.

For a restore or migration, also compare the user list, upload count, and recent content with the backup source.

## Roll back an update

Application code and persisted data are a pair. Do not start an older image against a database already migrated by a newer version. Roll back with both the verified pre-update archive and the previous image digest.

1. Remove the instance from public traffic or enable a maintenance response at the proxy.
2. Follow [Restore in place](#restore-in-place) with the verified pre-update archive, but stop after extraction and permission repair. Do not run its ordinary start step.
3. Select the previous image digest and let the installer repair and start the restored configuration:

   ```bash
   sudo ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage@sha256:PREVIOUS_DIGEST orbitpage install
   ```

   Use the exact digest recorded before the update. Do not use `latest` for rollback.

4. Complete the health and smoke test and confirm that `/health` reports the expected previous version.
5. Return traffic only after login, content, and uploads are confirmed.

Without a compatible pre-update backup and the previous image, recover on an isolated host before changing the live instance.

## Uninstall or purge

Removal and purge are different operations:

| Command | Application container and `/opt/orbitpage` | Data | Secret file | Local backups |
| --- | --- | --- | --- | --- |
| `sudo orbitpage uninstall` | Removed | Preserved | Preserved | Preserved |
| `sudo orbitpage uninstall --purge` | Removed | Permanently deleted | Permanently deleted | Permanently deleted |

Before either operation, create a verified off-host backup. A normal uninstall can be reversed by running the installer again; it reuses the preserved data and secret.

Interactive purge requires typing `DELETE`:

```bash
sudo orbitpage uninstall --purge
```

Non-interactive purge requires an explicit confirmation variable:

```bash
sudo ORBITPAGE_CONFIRM_PURGE=YES orbitpage uninstall --purge
```

Purge is irreversible from that host. The command removes `/var/backups/orbitpage` too, so an off-host copy must exist before it runs.

## Proxmox backup and restore

Replace `CTID` and storage placeholders with your guest and storage IDs.

For an application backup, run the same backup procedure inside the guest:

```bash
pct exec CTID -- orbitpage backup
```

Copy the archive and checksum off the guest with `pct pull`, restrict the host copies to mode `0600`, and follow [Restore in place](#restore-in-place) inside the replacement guest.

For a whole-guest backup, stop-mode backup keeps SQLite consistent:

```bash
vzdump CTID --mode stop --compress zstd --storage BACKUP_STORAGE
pct restore NEW_CTID /path/to/vzdump-lxc-backup.tar.zst --storage ROOTFS_STORAGE
```

For a VM, use `vzdump VMID` and `qmrestore /path/to/vzdump-qemu-backup.vma.zst NEW_VMID --storage VM_STORAGE`.

Restore to a new ID and isolate its network before starting it. A snapshot on the same storage does not replace an off-host backup.

To update or remove only the application, run `pct exec CTID -- orbitpage update` or `pct exec CTID -- orbitpage uninstall`. The latter keeps data. To remove the whole guest, first verify its ID and off-host backup:

```bash
pct status CTID
pct config CTID
pct stop CTID
pct destroy CTID --purge
```

The final command permanently removes the guest and its contents.
