# Deployment

Docker is the recommended production deployment path for OrbitPage. It keeps the frontend build, Express runtime, SQLite database, and uploads on one host with one persistent data directory.

## Choose a deployment model

| Model | Use it when | Operational owner |
| --- | --- | --- |
| [Docker image or Compose](#docker-image-recommended) | You already operate Docker and want the shortest supported path | You own the secret file, persistent data, backups, updates, and rollback |
| [Linux installer](#one-command-linux-install) | You have a supported Debian or Ubuntu server, VM, or LXC | `orbitpage` manages the container, backups, updates, and removal |
| [Proxmox VE installer](#one-command-proxmox-ve-install) | You want the installer to create a new unprivileged LXC | Proxmox manages the guest; `orbitpage` manages the app inside it |
| [Container platform](#generic-cloud-and-container-platforms) | The platform provides a durable POSIX volume and secret store | The platform owns HTTPS and scheduling; you still own SQLite backups |

OrbitPage uses SQLite and local uploads. Run exactly one application replica against a given `DATA_DIR`. Do not place `/app/data` on an ephemeral or eventually consistent filesystem, and do not share it between replicas.

## Docker image (recommended)

OrbitPage publishes a prebuilt Linux amd64 image to two registries:

| Registry | Image |
| --- | --- |
| Docker Hub | `paueron/orbitpage` |
| GitHub Container Registry | `ghcr.io/paoloronco/orbitpage` |

Pull the image from either registry:

```bash
sudo docker pull paueron/orbitpage:latest
# Or: sudo docker pull ghcr.io/paoloronco/orbitpage:latest
```

Both registries receive the same image after the complete `main` CI passes. The `latest` and `main` tags follow that build, while `sha-<commit>` pins it. Immutable version tags are published with [GitHub Releases](https://github.com/paoloronco/OrbitPage/releases). Use a complete `vX.Y.Z` tag when updates and rollback must be deterministic; use `latest` only when the deployment intentionally follows the newest green `main` build.

### Prepare the secret and persistent data

Do not pass `JWT_SECRET` with `docker run -e JWT_SECRET=...`: process arguments can be captured by shell history, process inspection, or automation logs. Create a root-owned runtime file without printing the generated value:

```bash
sudo install -d -m 0700 /etc/orbitpage
sudo install -d -m 0750 /var/lib/orbitpage
sudo bash <<'EOF'
set -euo pipefail
umask 077
env_file=/etc/orbitpage/orbitpage.env
printf 'NODE_ENV=production\n' > "$env_file"
printf 'PORT=8080\n' >> "$env_file"
printf 'DATA_DIR=/app/data\n' >> "$env_file"
printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$env_file"
chmod 0600 "$env_file"
EOF
```

Keep the environment file out of the repository and include it only in encrypted, access-controlled disaster-recovery backups.

### Start with Docker Run

```bash
sudo docker run -d --name orbitpage \
  --restart unless-stopped \
  --env-file /etc/orbitpage/orbitpage.env \
  -p 8080:8080 \
  -v /var/lib/orbitpage:/app/data \
  --security-opt no-new-privileges:true \
  paueron/orbitpage:latest
```

`--restart unless-stopped` restarts OrbitPage after a failure or host reboot but respects an explicit `docker stop`. Replace it with `--restart always` only when the container must return after a Docker daemon restart even if it was stopped manually.

Verify the running container:

```bash
sudo docker ps --filter name=orbitpage
sudo docker logs --tail 100 orbitpage
curl -fsS http://127.0.0.1:8080/health
```

Open `http://SERVER_IP:8080/dashboard/profile` for first setup. A fresh public URL shows **Under construction** until setup is complete.

### Start with Docker Compose

Use `env_file` in the production Compose definition instead of storing the secret in YAML:

```yaml
services:
  orbitpage:
    image: paueron/orbitpage:vX.Y.Z
    container_name: orbitpage
    restart: unless-stopped
    env_file:
      - /etc/orbitpage/orbitpage.env
    ports:
      - "8080:8080"
    volumes:
      - /var/lib/orbitpage:/app/data
    security_opt:
      - no-new-privileges:true
```

Replace `vX.Y.Z` with a real release tag, save the file as `compose.production.yaml`, and start it:

```bash
sudo docker compose -f compose.production.yaml pull
sudo docker compose -f compose.production.yaml up -d
```

The repository `docker-compose.yml` contains a public placeholder secret and is only for local evaluation on a trusted machine. Never put a real secret in a tracked file.

### Required container settings

| Variable | Purpose |
| --- | --- |
| `NODE_ENV=production` | Enables production behavior |
| `PORT=8080` | Sets the container listener |
| `JWT_SECRET` | Signs sessions and protects encrypted server-side secrets |
| `DATA_DIR=/app/data` | Places all persistent data on the mounted volume |

Recommended behind a proxy, CDN, tunnel, or managed cloud domain:

```text
PUBLIC_SITE_URL=https://links.example.com
PUBLIC_SITE_NAME=Example Links
```

Docker environment variables remain visible to users with Docker-daemon or root access. Restrict that access. See [Configuration](./Configuration.md) for every runtime setting and the `RESET_TOKEN` recovery lifecycle, then follow [Persistent data and backup types](#persistent-data-and-backup-types) before going live.

## One-command Linux install

The repository includes a production installer for an existing x86-64 Debian 12/13 or Ubuntu 22.04/24.04 server, VM, or LXC:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh | sudo bash
```

It:

- validates the operating system and architecture;
- refuses to modify a Proxmox VE host directly;
- installs Docker Engine and Compose v2 from Docker's official apt repository when needed;
- generates a 256-bit JWT secret without printing it;
- stores runtime secrets in `/etc/orbitpage/orbitpage.env` with mode `0600`;
- persists SQLite and uploads under `/var/lib/orbitpage`;
- starts the container with `no-new-privileges` and a health check;
- installs the `orbitpage` management command.

The default endpoint is `http://SERVER_IP:8080`. A fresh public URL shows **Under construction**. Open `/dashboard/profile` to run dependency checks, create the fixed `admin` password, choose the primary page slug, and enter the dashboard.

### Installation options

Set overrides before the installer:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh | \
  sudo ORBITPAGE_HTTP_PORT=8090 \
  ORBITPAGE_BIND_ADDRESS=127.0.0.1 \
  ORBITPAGE_PUBLIC_SITE_URL=https://links.example.com \
  bash
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORBITPAGE_HTTP_PORT` | `8080` | Host HTTP port |
| `ORBITPAGE_BIND_ADDRESS` | `0.0.0.0` | Host interface; use `127.0.0.1` behind a local reverse proxy |
| `ORBITPAGE_PUBLIC_SITE_URL` | Empty | Canonical HTTPS URL |
| `ORBITPAGE_IMAGE` | `ghcr.io/paoloronco/orbitpage:latest` | Image or immutable version tag to deploy |
| `ORBITPAGE_DATA_DIR` | `/var/lib/orbitpage` | Persistent database and media path |

Pin an immutable release tag when deterministic updates and rollback are required:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh | \
  sudo ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:vX.Y.Z bash
```

Use a real tag from [GitHub Releases](https://github.com/paoloronco/OrbitPage/releases). Do not copy the literal `vX.Y.Z` placeholder.

### Management commands

```bash
orbitpage status
orbitpage logs
orbitpage start
orbitpage stop
orbitpage restart
orbitpage backup
orbitpage update
orbitpage config
orbitpage uninstall
```

`orbitpage config` prints paths and non-secret settings. It does not print `JWT_SECRET` or `RESET_TOKEN`.

## One-command Proxmox VE install

Run this command as `root` on an x86-64 Proxmox VE 8 or newer node:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install-pve.sh | bash
```

The host installer:

- verifies that it is running on a supported Proxmox VE node;
- chooses the next free CT ID and compatible active storages;
- downloads the newest Debian 12 amd64 LXC template when it is not cached;
- creates a new unprivileged LXC with 2 cores, 2 GB RAM, 512 MB swap, and a 12 GB root disk;
- enables only `nesting=1` and `keyctl=1`, which Docker needs inside an unprivileged LXC;
- connects `eth0` to `vmbr0` with DHCP and IPv6 autoconfiguration;
- sets the Proxmox firewall flag on the LXC network interface;
- enables automatic startup with a controlled startup/shutdown order;
- runs the tested Linux installer inside the guest;
- waits for guest networking and the OrbitPage health check.

The firewall flag does not enable the Datacenter, Node, or CT firewall and does not create rules. The Proxmox operator remains responsible for enabling the firewall layers and defining an allowlist policy.

Docker, the database, media, and OrbitPage secrets stay inside the LXC. The PVE host receives no Docker packages or application secrets. The installer creates a new CT; it does not adopt an existing VM or LXC.

### PVE installation options

Pass overrides before `bash`:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install-pve.sh | \
  ORBITPAGE_PVE_CTID=250 \
  ORBITPAGE_PVE_HOSTNAME=orbitpage \
  ORBITPAGE_PVE_CORES=4 \
  ORBITPAGE_PVE_MEMORY=4096 \
  ORBITPAGE_PVE_DISK_GB=24 \
  ORBITPAGE_PVE_BRIDGE=vmbr0 \
  ORBITPAGE_HTTP_PORT=8080 \
  bash
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORBITPAGE_PVE_CTID` | Next cluster ID | Explicit unused container ID |
| `ORBITPAGE_PVE_HOSTNAME` | `orbitpage` | LXC hostname |
| `ORBITPAGE_PVE_CORES` | `2` | CPU cores |
| `ORBITPAGE_PVE_MEMORY` | `2048` | RAM in MB |
| `ORBITPAGE_PVE_SWAP` | `512` | Swap in MB |
| `ORBITPAGE_PVE_DISK_GB` | `12` | Root disk size in GB |
| `ORBITPAGE_PVE_ROOTFS_STORAGE` | First active `rootdir` storage | Root disk storage |
| `ORBITPAGE_PVE_TEMPLATE_STORAGE` | First active `vztmpl` storage | Template storage |
| `ORBITPAGE_PVE_TEMPLATE` | Latest Debian 12 amd64 | Exact Proxmox template filename |
| `ORBITPAGE_PVE_BRIDGE` | `vmbr0` | PVE network bridge |
| `ORBITPAGE_PVE_IP` | `dhcp` | `dhcp` or static IPv4 CIDR |
| `ORBITPAGE_PVE_GATEWAY` | Empty | IPv4 gateway for static addressing |
| `ORBITPAGE_PVE_VLAN` | Empty | Optional VLAN tag, 1-4094 |
| `ORBITPAGE_PVE_FIREWALL` | `1` | Set the PVE firewall flag on `eth0` |
| `ORBITPAGE_PVE_SSH_PUBLIC_KEY` | Empty | Host path to a public key authorized for LXC root |
| `ORBITPAGE_HTTP_PORT` | `8080` | OrbitPage port inside the LXC |
| `ORBITPAGE_PUBLIC_SITE_URL` | Empty | Optional canonical public HTTPS URL |
| `ORBITPAGE_IMAGE` | `ghcr.io/paoloronco/orbitpage:latest` | Image or pinned version installed in the LXC |

Example with a static address and VLAN:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install-pve.sh | \
  ORBITPAGE_PVE_IP=192.0.2.50/24 \
  ORBITPAGE_PVE_GATEWAY=192.0.2.1 \
  ORBITPAGE_PVE_VLAN=30 \
  ORBITPAGE_PVE_SSH_PUBLIC_KEY=/root/.ssh/id_ed25519.pub \
  bash
```

After installation, use the printed CT ID:

```bash
pct exec CTID -- orbitpage status
pct exec CTID -- orbitpage logs
pct exec CTID -- orbitpage backup
pct exec CTID -- orbitpage update
pct enter CTID
```

Open `http://LXC_IP:8080/dashboard/profile` for first setup.

### Existing Proxmox guests and failed installs

Choose the procedure that matches the guest:

| Guest | Procedure |
| --- | --- |
| New LXC created by OrbitPage | Run `install-pve.sh` on the PVE host |
| Existing Debian LXC | Enable `nesting=1,keyctl=1`, start the CT, then run `install.sh` inside it |
| Existing Debian VM | Run `install.sh` inside the VM; no PVE Docker features are required |
| Guest created by a community script | Treat that script as guest provisioning only, then use the official `install.sh` and this runbook inside the guest |

For an existing stopped LXC:

```bash
pct set CTID -features nesting=1,keyctl=1
pct start CTID
pct exec CTID -- bash -lc "curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh | bash"
```

Review any third-party guest defaults before production use. OrbitPage does not maintain external community provisioning scripts.

If `install-pve.sh` fails after creating a CT, it leaves that CT for inspection. Review the target before removing it:

```bash
pct status CTID
pct config CTID
pct stop CTID 2>/dev/null || true
pct destroy CTID --purge
```

The final command destroys the whole guest. Do not run it against a CT that contains data you need.

## Persistent data and backup types

Always persist `/app/data`. It contains:

- `orbitpage.db` and any SQLite sidecars;
- uploaded files under `uploads/`;
- runtime data needed across container upgrades.

There are two distinct backup types:

| Backup | Use | Limit |
| --- | --- | --- |
| Dashboard JSON export | Move or selectively restore application content | Not an infrastructure disaster-recovery backup |
| `orbitpage backup` archive | Restore the installed app, database, uploads, Compose definition, and secret file | Contains secrets; protect and encrypt it |

The management command stops a running OrbitPage container before creating the archive, then restarts it. This gives SQLite and its sidecars a consistent application-level snapshot.

## Create and verify an infrastructure backup

The following procedure applies to installations managed by `orbitpage`. `orbitpage` has no restore command; restore is the explicit manual procedure in the next section.

1. Check the installation and choose an off-data destination:

   ```bash
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
   sudo tar -tzf "$BACKUP" | grep -Fxq 'etc/orbitpage/orbitpage.env'
   sudo tar -tzf "$BACKUP" | grep -Fxq 'opt/orbitpage/compose.yaml'
   sudo tar -tzf "$BACKUP" | grep -Fxq "$DATA_ENTRY"
   test "$(sudo stat -c '%a' "$BACKUP")" = '600'

   sudo sha256sum "$BACKUP" |
     awk -v name="$BACKUP_NAME" '{ print $1 "  " name }' |
     sudo tee "${BACKUP}.sha256" >/dev/null
   sudo chmod 0600 "${BACKUP}.sha256"
   sudo bash -c 'cd "$1" && sha256sum -c "$2"' \
     _ "$BACKUP_DIRECTORY" "${BACKUP_NAME}.sha256"
   ```

4. Copy the archive and checksum to encrypted storage outside the application host. A backup that exists only beside the live database is not disaster recovery.

5. Periodically restore a copy into an isolated VM or LXC, keep it disconnected from production DNS, and complete the [post-change smoke test](#post-change-health-and-smoke-test). Archive integrity alone does not prove that the recovery process works.

Define retention for both local and off-host copies. Never sync a live SQLite file independently from its sidecars while OrbitPage is running.

## Restore an infrastructure backup

This procedure replaces the current data, configuration, and installer definition. Use only an archive created by `orbitpage backup`, verify its checksum, and perform the first restore drill away from production.

### Restore in place

1. Copy the archive and its `.sha256` file to the host. Verify them before stopping the service:

   ```bash
   BACKUP=/var/backups/orbitpage/orbitpage-YYYYMMDD-HHMMSS.tar.gz
   BACKUP_DIRECTORY="$(dirname "$BACKUP")"
   BACKUP_NAME="$(basename "$BACKUP")"
   sudo bash -c 'cd "$1" && sha256sum -c "$2"' \
     _ "$BACKUP_DIRECTORY" "${BACKUP_NAME}.sha256"
   sudo gzip -t "$BACKUP"
   sudo tar -tzf "$BACKUP" | less
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
2. Install OrbitPage with the archived `ORBITPAGE_DATA_DIR` and the immutable image tag used by the backup.
3. Stop the new empty instance.
4. Follow the in-place restore procedure on that host.
5. Keep production DNS and proxy traffic pointed at the old host until the replacement passes health, public-page, dashboard, login, and upload checks.

If `/usr/local/bin/orbitpage` is missing after a full-host recovery, extract the archive first, then rerun the Linux installer. It preserves the restored secret and data, repairs the CLI and Compose definition, and performs its own health check.

## Update safely

### Installer-managed deployment

1. Record the current image and health version:

   ```bash
   sudo docker inspect orbitpage --format 'image={{.Config.Image}} id={{.Image}}'
   curl -fsS --max-time 10 http://127.0.0.1:8080/health
   ```

2. Create and verify a named pre-update backup using the earlier procedure. Copy it off-host.

3. Update:

   - If the installation intentionally follows `latest`:

     ```bash
     sudo orbitpage update
     ```

   - If releases are pinned, install the new immutable tag:

     ```bash
     sudo ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:vA.B.C orbitpage install
     ```

   Both commands create another consistent backup. The explicit verified backup remains the rollback checkpoint.

4. Run the post-change checks below. Do not delete the previous image or pre-update backup until the new version has completed an acceptance period.

### Manual Docker or Compose deployment

Back up the mounted data directory while the container is stopped, preserve the protected environment file, record the old immutable image tag, pull the new tag, and recreate the container with the same volume and `--env-file`. A plain `docker restart` does not load changes from an environment file.

For Compose:

```bash
docker compose -f compose.production.yaml pull
docker compose -f compose.production.yaml up -d --remove-orphans
```

Run the same health and smoke test after recreation.

## Post-change health and smoke test

Use the local bind address and configured port; the examples use the installer default:

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

For a restore or migration, also compare the expected page slug, user list, upload count, and recent content with the backup source.

## Roll back an update

Application code and persisted data are a pair. Do not start an older image against a database already migrated by a newer version. Roll back with both the verified pre-update archive and the previous immutable image tag.

1. Remove the instance from public traffic or enable a maintenance response at the proxy.
2. Follow [Restore in place](#restore-in-place) with the verified pre-update archive, but stop after extraction and permission repair. Do not run its ordinary start step.
3. Select the previous immutable image and let the installer repair and start the restored configuration:

   ```bash
   sudo ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:vW.X.Y orbitpage install
   ```

   Use the exact tag recorded before the update. Do not use `latest` for rollback.

4. Complete the health and smoke test and confirm that `/health` reports the expected previous version.
5. Return traffic only after login, content, and uploads are confirmed.

If no compatible pre-update backup and previous image tag exist, stop and recover in an isolated host. Repeatedly recreating containers can make diagnosis and recovery harder.

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

## Proxmox backup, restore, update, and removal

Use two backup layers:

1. `orbitpage backup` inside the guest for a portable, application-consistent archive;
2. a Proxmox `vzdump` backup for whole-guest disaster recovery.

### Application-level backup from the PVE host

```bash
install -d -m 0750 /srv/orbitpage-backups
BACKUP_NAME="orbitpage-pve-$(date -u +%Y%m%d-%H%M%S).tar.gz"
pct exec CTID -- orbitpage backup "/var/backups/orbitpage/$BACKUP_NAME"
pct pull CTID \
  "/var/backups/orbitpage/$BACKUP_NAME" \
  "/srv/orbitpage-backups/$BACKUP_NAME"
cd /srv/orbitpage-backups
sha256sum "$BACKUP_NAME" > "${BACKUP_NAME}.sha256"
sha256sum -c "${BACKUP_NAME}.sha256"
```

Store the checksum and archive on backup storage outside the guest. To restore, create or isolate the replacement CT, copy the archive into it, and follow the normal restore procedure inside that guest:

```bash
pct exec NEW_CTID -- install -d -m 0750 /var/backups/orbitpage
pct push NEW_CTID \
  "/srv/orbitpage-backups/$BACKUP_NAME" \
  "/var/backups/orbitpage/$BACKUP_NAME" \
  --perms 0600
pct push NEW_CTID \
  "/srv/orbitpage-backups/${BACKUP_NAME}.sha256" \
  "/var/backups/orbitpage/${BACKUP_NAME}.sha256" \
  --perms 0600
pct exec NEW_CTID -- bash -c \
  'cd /var/backups/orbitpage && sha256sum -c "$1"' \
  _ "${BACKUP_NAME}.sha256"
```

Install an empty OrbitPage instance in the replacement CT with the archived data path and image tag before following [Restore in place](#restore-in-place). Keep the replacement guest off production DNS until its health and smoke tests pass.

### Whole-guest backup and restore

Use stopped-mode backups for deterministic SQLite recovery:

```bash
vzdump CTID --mode stop --compress zstd --storage BACKUP_STORAGE
```

For a VM, replace `CTID` with the VM ID; `vzdump` detects the guest type. Restore to a new ID first:

```bash
pct restore NEW_CTID /path/to/vzdump-lxc-CTID-YYYY_MM_DD-HH_MM_SS.tar.zst --storage ROOTFS_STORAGE
```

For a QEMU VM backup:

```bash
qmrestore /path/to/vzdump-qemu-VMID-YYYY_MM_DD-HH_MM_SS.vma.zst NEW_VMID --storage VM_STORAGE
```

Keep the restored guest disconnected or assign a different address before starting it, so it cannot collide with production. A Proxmox snapshot on the same storage is useful for short maintenance windows but is not an off-host backup.

### Updates and removal

From the PVE host, update an installation that intentionally follows its currently configured tag:

```bash
pct exec CTID -- orbitpage update
pct exec CTID -- orbitpage status
pct exec CTID -- bash -lc '
  port="$(sed -n "s/^ORBITPAGE_HTTP_PORT=//p" /opt/orbitpage/.env)"
  curl -fsS --max-time 10 "http://127.0.0.1:${port:-8080}/health"
'
```

For a pinned deployment, provide the next immutable tag explicitly instead of expecting `orbitpage update` to change it:

```bash
pct exec CTID -- env \
  ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:vA.B.C \
  orbitpage install
```

Update the PVE host, guest operating system, and OrbitPage application as separate maintenance tasks, with a backup before each layer.

To remove only OrbitPage while preserving guest data:

```bash
pct exec CTID -- orbitpage uninstall
```

To purge OrbitPage data but keep the guest:

```bash
pct exec CTID -- env ORBITPAGE_CONFIRM_PURGE=YES orbitpage uninstall --purge
```

To remove the whole guest, first verify the CT ID and off-host backups:

```bash
pct status CTID
pct config CTID
pct stop CTID
pct destroy CTID --purge
```

## Generic cloud and container platforms

OrbitPage can run only where all of these conditions are true:

- one application replica owns the SQLite database;
- `/app/data` is a writable, durable POSIX volume that survives replacement;
- the platform can mount the same volume on the replacement instance;
- `JWT_SECRET` comes from a stable secret store;
- the platform can probe `/health`;
- backups are copied outside the application volume.

Stateless/serverless filesystems, scale-to-zero replacement without a persistent volume, multi-replica SQLite access, and eventually consistent object mounts are not supported deployment models. A platform may support Docker but still fail these storage requirements.

When the compatibility gate passes:

1. use the repository `Dockerfile` or a pinned published image;
2. set `PORT=8080`;
3. inject a stable `JWT_SECRET` from the platform secret store;
4. mount the durable volume at `/app/data`;
5. configure exactly one replica;
6. attach HTTPS and set `PUBLIC_SITE_URL`;
7. configure `/health` as the readiness/liveness check;
8. schedule off-platform backups and a restore drill.

`ENABLE_HTTPS=true` starts a self-signed listener and is normally unnecessary when the platform terminates HTTPS.

## Reverse proxy notes

When running behind Nginx, Caddy, Traefik, Cloudflare, or a platform proxy:

- forward the original host and protocol headers;
- set `PUBLIC_SITE_URL` if OrbitPage receives internal hostnames;
- do not cache `/api/*`;
- keep `/uploads/*` publicly readable when media is shown on the public page;
- bind OrbitPage to `127.0.0.1` when the reverse proxy runs on the same host;
- terminate trusted HTTPS before exposing the dashboard.

See [Troubleshooting](./Troubleshooting.md) for startup, proxy, login, and indexing failures.
