# Deployment

Install OrbitPage with Docker, the Linux installer, or the Proxmox installer. Run one instance per data directory: SQLite and uploads require a persistent local filesystem.

| Method | Requirements |
| --- | --- |
| [Docker Run or Compose](#docker-image-recommended) | Docker on amd64 or arm64 |
| [Linux installer](#linux-installer) | x86-64 Debian 12/13 or Ubuntu 22.04/24.04 |
| [Proxmox installer](#proxmox-ve-installer) | x86-64 Proxmox VE 8+ |
| [Container platform](#generic-cloud-and-container-platforms) | One replica and a durable POSIX volume |

Source installation: [Getting started](./Getting-started.md). Environment settings: [Configuration](./Configuration.md). Backups, restore, and rollback: [Maintenance](./maintenance.md).

## Docker image (recommended)

| Registry | Image |
| --- | --- |
| Docker Hub | `paoloronco/orbitpage` |
| GHCR | `ghcr.io/paoloronco/orbitpage` |

Use `latest` for the current stable release, a full `X.Y.Z` tag to select a version, or `@sha256:DIGEST` to pin an exact image. Docker selects amd64 or arm64 automatically. Replace version/digest placeholders with an actual release value.

### Docker Run

```bash
docker pull paoloronco/orbitpage
docker run -d --name orbitpage --restart unless-stopped -p 127.0.0.1:8080:8080 -v orbitpage-data:/app/data --security-opt no-new-privileges:true paoloronco/orbitpage
```

On Linux, use `sudo docker` if required. Docker creates `orbitpage-data`; OrbitPage initializes the database, uploads, and a persistent instance secret there.

Open <http://localhost:8080/dashboard/profile> to create the administrator. The public page is at <http://localhost:8080>.

- Keep the same `/app/data` mount when replacing the container.
- Change `127.0.0.1:8080:8080` to use another host port.
- Use a named volume or an absolute host directory for storage.
- Configure [HTTPS](#reverse-proxy-notes) before remote access.

### Docker Compose

```bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
docker compose up -d
```

The included file binds `127.0.0.1:8080`, stores data in `./orbitpage-data`, and uses `restart: unless-stopped`. Complete setup at the same dashboard URL.

Edit the port, image, or volume in `docker-compose.yml` as needed. Keep the current data mount for an existing installation. Add `security_opt: ["no-new-privileges:true"]` to the service for the same restriction used by the Docker Run example.

### Data and secrets

Docker defaults to `PORT=8080`, `HOST=0.0.0.0`, `NODE_ENV=production`, and `DATA_DIR=/app/data`.

The entrypoint generates `.jwt-secret` once and reuses it. An explicit `JWT_SECRET` overrides that file and must be a stable private value of at least 32 characters. Losing the secret invalidates sessions and can make saved TOTP and provider credentials unreadable.

Back up the whole volume. Container removal keeps the volume; volume deletion removes its data. See [Maintenance](./maintenance.md).

### Optional setup token

For installations that need proof of host access before creating the first administrator, set `REQUIRE_SETUP_TOKEN=true` in the container environment before startup. In Compose:

```yaml
environment:
  REQUIRE_SETUP_TOKEN: "true"
```

Recreate the service, then read the token:

```bash
docker exec orbitpage cat /app/data/.setup-token
```

Enter it in the setup wizard with the new password. The token file is owner-only and is consumed after setup. Source installations can set the same variable.

Installer options:

```bash
sudo ./install.sh --require-setup-token
./install-pve.sh --require-setup-token
```

Read `/var/lib/orbitpage/.setup-token` on Linux, or use `pct exec CTID -- cat /var/lib/orbitpage/.setup-token` on Proxmox. `ORBITPAGE_REQUIRE_SETUP_TOKEN` is the equivalent installer override; reinstalls preserve the existing setting.

## Linux installer

On a supported Linux server, VM, or guest:

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
sudo ./install.sh
```

The installer adds Docker/Compose when needed, configures the container, creates persistent storage, and installs the `orbitpage` management command. Re-running it preserves the existing data and secret and creates a backup.

| Setting | Default |
| --- | --- |
| Image | `ghcr.io/paoloronco/orbitpage:latest` |
| HTTP address | `127.0.0.1:8080` |
| Data | `/var/lib/orbitpage` |
| Runtime secrets | `/etc/orbitpage/orbitpage.env`, mode `0600` |
| Compose definition and installer settings | `/opt/orbitpage` |
| Backups | `/var/backups/orbitpage` |

Open <http://localhost:8080/dashboard/profile> on the host, or connect through a trusted HTTPS proxy. The installer does not expose HTTP to the network by default.

### Installation options

```bash
sudo ORBITPAGE_HTTP_PORT=8090 \
  ORBITPAGE_PUBLIC_SITE_URL=https://page.example.com \
  ./install.sh
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORBITPAGE_HTTP_PORT` | `8080` | Host port |
| `ORBITPAGE_BIND_ADDRESS` | `127.0.0.1` | Host listener address |
| `ORBITPAGE_PUBLIC_SITE_URL` | Empty | Public HTTPS URL |
| `ORBITPAGE_IMAGE` | GHCR `latest` | Image tag or digest |
| `ORBITPAGE_DATA_DIR` | `/var/lib/orbitpage` | Data directory |
| `ORBITPAGE_CONTAINER_NAME` | `orbitpage` | Container name |
| `ORBITPAGE_REQUIRE_SETUP_TOKEN` | `false` for new installs | Host token for setup |

### Management commands

Run with `sudo orbitpage COMMAND`:

| Command | Action |
| --- | --- |
| `status`, `logs` | Inspect the instance |
| `start`, `stop`, `restart` | Control the container |
| `config` | Show paths and non-secret settings |
| `backup [ARCHIVE]` | Stop, archive data/configuration, then restart |
| `update` | Update the configured image and verify health |
| `web-updates [NAME]` | Enable or repair dashboard installation |
| `uninstall` | Remove the application while keeping data |

Update and purge details are below and in [Maintenance](./maintenance.md).

## Proxmox VE installer

Run on the Proxmox host as root:

```bash
apt-get update
apt-get install -y git
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
./install-pve.sh
```

The installer creates a new unprivileged Debian 12 LXC, enables `nesting=1,keyctl=1`, and runs the Linux installer inside it. Docker and application data stay in the guest.

The host must have patched `lxc-pve`: at least `6.0.0-2` on PVE 8, or `6.0.5-2` on PVE 9+. The script checks this before guest creation.

### PVE installation options

Set variables before running the script, for example `ORBITPAGE_PVE_MEMORY=4096 ./install-pve.sh`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORBITPAGE_PVE_CTID` | Next free cluster ID | New guest ID |
| `ORBITPAGE_PVE_HOSTNAME` | `orbitpage` | Hostname |
| `ORBITPAGE_PVE_CORES` | `2` | CPU cores |
| `ORBITPAGE_PVE_MEMORY` | `2048` | RAM in MB |
| `ORBITPAGE_PVE_SWAP` | `512` | Swap in MB |
| `ORBITPAGE_PVE_DISK_GB` | `12` | Disk size in GB |
| `ORBITPAGE_PVE_ROOTFS_STORAGE` | First active rootdir storage | Root disk storage |
| `ORBITPAGE_PVE_TEMPLATE_STORAGE` | First active vztmpl storage | Template storage |
| `ORBITPAGE_PVE_TEMPLATE` | Latest Debian 12 amd64 | Template filename |
| `ORBITPAGE_PVE_BRIDGE` | `vmbr0` | Network bridge |
| `ORBITPAGE_PVE_IP` | `dhcp` | DHCP or IPv4 CIDR |
| `ORBITPAGE_PVE_GATEWAY` | Empty | Static IPv4 gateway |
| `ORBITPAGE_PVE_VLAN` | Empty | VLAN tag, 1–4094 |
| `ORBITPAGE_PVE_FIREWALL` | `1` | Network-interface firewall flag |
| `ORBITPAGE_PVE_SSH_PUBLIC_KEY` | Empty | Host path to a key authorized for guest root |
| `ORBITPAGE_HTTP_PORT` | `8080` | Guest application port |
| `ORBITPAGE_PUBLIC_SITE_URL` | Empty | Public HTTPS URL |
| `ORBITPAGE_IMAGE` | GHCR `latest` | Guest application image |
| `ORBITPAGE_REQUIRE_SETUP_TOKEN` | `false` for new installs | Host token for setup |

The firewall flag does not enable Proxmox firewall layers or create allow rules; configure those in Proxmox.

`ORBITPAGE_PVE_WAIT_ATTEMPTS` (90) and `ORBITPAGE_PVE_WAIT_SECONDS` (2) control guest-start polling.

### Access and existing guests

OrbitPage listens on guest loopback. Use an HTTPS proxy inside the guest. A proxy on the PVE host cannot reach that loopback listener.

If you supplied an SSH public key, forward the port from your browser machine:

```bash
ssh -L 8080:127.0.0.1:8080 root@GUEST_IP
```

Then open <http://localhost:8080/dashboard/profile>. Manage the application with `pct exec CTID -- orbitpage status`, `logs`, `backup`, or `update`.

For an existing Debian/Ubuntu VM, run `install.sh` inside the VM. For an existing supported LXC, enable `nesting=1,keyctl=1` while stopped, start it, then run `install.sh` inside it.

A failed new-guest installation leaves the guest available for inspection. Check its logs and configuration before retrying or removing it. Guest backups and removal are in [Maintenance](./maintenance.md#proxmox-backup-and-restore).

## Update safely

Back up before updating and retain the previous image reference. Keep the same data mount and secret.

In **Account → General → Instance details**, click **Check for updates**, then **Install update…**. Installation requires the host service described below; otherwise the dialog provides terminal instructions.

| Installation | Update |
| --- | --- |
| Linux/Proxmox following `latest` | `sudo orbitpage update`; inside an LXC, use `pct exec CTID -- orbitpage update` |
| Pinned installer image | `sudo ORBITPAGE_IMAGE=IMAGE@sha256:NEW_DIGEST orbitpage install` |
| Compose | `docker compose pull`, then `docker compose up -d` using the current project and file |
| Docker Run | Pull, stop/remove the container, then recreate it with its original ports, environment, and data mount |
| Source | Stop the process, `git pull --ff-only`, `npm ci`, `npm run install:server`, then `NODE_ENV=production npm run start` with the existing secret |

For a source service, build with `npm run build` and restart the service instead of starting a second process. A pinned image stays pinned until you change it. `docker restart` loads neither a new image nor an edited environment file.

After updating, check `/health`, the public page, dashboard login, and uploaded media. See [Maintenance](./maintenance.md) for verification and rollback.

### Manual Docker or Compose deployment

To replace a container created with the Docker Run example:

```bash
docker pull paoloronco/orbitpage
docker stop orbitpage
docker rm orbitpage
docker run -d --name orbitpage --restart unless-stopped -p 127.0.0.1:8080:8080 -v orbitpage-data:/app/data --security-opt no-new-privileges:true paoloronco/orbitpage
```

Use your original settings if they differ. Removing the container keeps its named volume; do not remove the volume.

Existing `orbitpage-update` host commands remain supported. Helpers installed before v4.21.45 on source deployments must be replaced from a trusted official release before running them: install `scripts/orbitpage-update.py` and `scripts/orbitpage-update.sh` in their root-owned host paths. New source installations do not require that updater.

### Web updates

The Linux installer enables the host service for official `latest` images on systemd hosts. It enables **Install update…**; checking for updates is still a manual dashboard action.

For an existing Docker Run or Compose container:

```bash
git clone https://github.com/paoloronco/OrbitPage.git
sudo ./OrbitPage/install.sh web-updates orbitpage
```

This installs the host helper/service without recreating the application. It requires Python 3, systemd, an official `latest` image, and a writable persistent `/app/data` mount. Source installs, custom images, and pinned releases use terminal updates.

Only an administrator with the current password can start installation. The service uses a private Unix socket; OrbitPage does not receive the Docker socket or sudo access. Writes are blocked during the update. The dialog shows logs, reconnects during restart, and waits for the expected version and health check before reporting success.

If contact is lost, the result remains unconfirmed. Inspect the service and retained backup before retrying:

```bash
sudo systemctl status orbitpage-updates-orbitpage.service
sudo journalctl -u orbitpage-updates-orbitpage.service
```

The example uses the default container name. Logs live under `/var/lib/orbitpage-updates/`; backups under `/var/backups/orbitpage/`. Disable the service with `sudo systemctl disable --now orbitpage-updates-orbitpage.service` to revoke dashboard installation.

## Generic cloud and container platforms

A platform must provide:

- one running replica for each SQLite database;
- a writable durable POSIX volume at `/app/data`, retained on replacement;
- HTTPS, a `/health` probe, and off-volume backups.

Stateless filesystems, shared multi-replica SQLite, and object-storage mounts are unsupported. Set `PUBLIC_SITE_URL` to the public HTTPS URL. Docker can generate its secret on the persistent volume, or you can inject a stable `JWT_SECRET` from the platform secret store.

## Reverse proxy notes

- Keep the application on loopback when the proxy runs on the same host.
- Terminate HTTPS at the proxy and forward the original host/protocol.
- Set `PUBLIC_SITE_URL` to the public URL.
- Set `ORBITPAGE_TRUST_PROXY` only to the actual proxy addresses or CIDRs when forwarded headers are needed.
- Do not cache `/api/*`, `/dashboard/*`, or `/health`.
- Allow public media requests under `/uploads/*`.

`ENABLE_HTTPS=true` starts a self-signed listener; it is usually unnecessary behind the HTTPS proxy. See [Troubleshooting](./Troubleshooting.md) for proxy failures.

## Older Docker Hub images

The official image is `paoloronco/orbitpage`. The former `paueron/orbitpage` feed stops receiving updates on October 9, 2026.

- Installer-managed `latest` deployments migrate with `sudo orbitpage update`.
- Compose deployments change the service image and run `docker compose pull`, then `docker compose up -d`.
- Docker Run deployments recreate the container from the current image with the same settings and data mount.
- Pinned installations select a matching release tag explicitly.

An old standalone `orbitpage-update` command may still pull the former image. Replace it from the current official image before using it. Keep the existing data and verify the image and `/health` after replacement.
