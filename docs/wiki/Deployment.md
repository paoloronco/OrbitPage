# Deployment

OrbitPage can be deployed with **Docker**, the **Linux installer**, or the **Proxmox VE installer**.

---

<a id="docker-image-recommended"></a>
<a id="docker"></a>

## Docker (recommended)

| Registry | Image |
| --- | --- |
| Docker Hub | `paoloronco/orbitpage` |
| GitHub Container Registry | `ghcr.io/paoloronco/orbitpage` |

Use:

- `latest` for the current stable release;
- `X.Y.Z` to pin a specific release;
- `@sha256:DIGEST` to pin an exact image.

Replace version and digest placeholders with actual release values. Docker automatically selects the `amd64` or `arm64` image.

<a id="generic-cloud-and-container-platforms"></a>

OrbitPage also runs on Docker-based hosting platforms. Use one replica and a writable, persistent local volume at `/app/data`; keep that volume when replacing the container. Configure HTTPS and a `/health` check on the platform. Stateless storage and shared multi-replica SQLite are unsupported.

### Docker Run (recommended)

```bash
docker pull paoloronco/orbitpage:latest

docker run -d \
  --name orbitpage \
  --restart unless-stopped \
  -p 8080:8080 \
  -v orbitpage-data:/app/data \
  --security-opt no-new-privileges:true \
  paoloronco/orbitpage:latest
```

Open the [dashboard](http://device_ip:8080/dashboard/profile) and choose a password for the admin.<br>
The public page is at [http://device_ip:8080](http://device_ip:8080).<br>
Change the port or data mount in the command if needed.

#### Docker options

- `--name orbitpage`: names the container `orbitpage` for later commands.
- `--restart unless-stopped`: restarts after failures or Docker restarts, unless you stopped the container.
- `-p 8080:8080`: publishes port 8080 on all host interfaces; `-p 127.0.0.1:8080:8080` restricts it to the host.
- `-v orbitpage-data:/app/data`: stores the database, uploads, and generated secret in a persistent named volume.
- `--security-opt no-new-privileges:true`: prevents container processes from gaining additional privileges.

### GHCR

```bash
docker pull ghcr.io/paoloronco/orbitpage:latest

docker run -d \
  --name orbitpage \
  --restart unless-stopped \
  -p 8080:8080 \
  -v orbitpage-data:/app/data \
  --security-opt no-new-privileges:true \
  ghcr.io/paoloronco/orbitpage:latest
```

Open the [dashboard](http://device_ip:8080/dashboard/profile) and choose a password for the admin.<br>
The public page is at [http://device_ip:8080](http://device_ip:8080).<br>
Change the port or data mount in the command if needed.

The [Docker options](#docker-options) are the same; only the image address changes.

### Docker Compose

Clone the repository and start the included configuration:

```bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
docker compose up -d
```

| Setting | Default |
| --- | --- |
| Published port | `8080:8080` (all host interfaces) |
| Persistent data | `./orbitpage-data` |
| Restart policy | `unless-stopped` |

Open the [dashboard](http://device_ip:8080/dashboard/profile) and choose a password for the admin. The public page is at [http://device_ip:8080](http://device_ip:8080).

Edit `docker-compose.yml` to change the image, port, environment, or storage path.

Replace `device_ip` with the Docker host's LAN address. For local-only access, change the port mapping to `"127.0.0.1:8080:8080"` and use `localhost` in the URLs.

### Optional setup token

To add a token to the first admin setup:

| Installation | Enable before startup | Read the token |
| --- | --- | --- |
| Docker Run | Add `-e REQUIRE_SETUP_TOKEN=true` | `docker exec orbitpage cat /app/data/.setup-token` |
| Docker Compose | Set `REQUIRE_SETUP_TOKEN: "true"` under `environment` | `docker compose exec orbitpage cat /app/data/.setup-token` |
| Linux installer | Add `--require-setup-token` | `sudo cat /var/lib/orbitpage/.setup-token` |
| Proxmox installer | Add `--require-setup-token` | `pct exec CTID -- cat /var/lib/orbitpage/.setup-token` |

Enter the token when choosing the admin password. It can be used once.

### Older Docker Hub images

The former `paueron/orbitpage` feed stops receiving updates on October 9, 2026. Use `paoloronco/orbitpage` with the same data mount. Installer-managed `latest` deployments migrate with `sudo orbitpage update`; manual deployments follow [Updating OrbitPage](#updating-orbitpage). Replace old standalone `orbitpage-update` helpers from the current official image before using them.

---

## Linux installer

Use a Debian 12/13 or Ubuntu 22.04/24.04/26.04 server, VM, or LXC on **amd64 or arm64**. For other Linux distributions, Windows, or macOS, use [Docker](#docker-recommended) with Linux containers.

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
sudo ./install.sh
```

The installer:

- installs Docker and Docker Compose when required;
- deploys the OrbitPage container;
- creates persistent storage;
- stores runtime secrets with restricted permissions;
- installs the `orbitpage` management command;
- preserves existing data and secrets and creates a backup when run again.

Open `http://SERVER_IP:8080/dashboard/profile` and choose a password for the admin. The public page is at `http://SERVER_IP:8080`. Replace `SERVER_IP` with the server's LAN address shown by the installer.

### Paths

| Location | Default |
| --- | --- |
| Application data | `/var/lib/orbitpage` |
| Runtime secrets | `/etc/orbitpage/orbitpage.env`, mode `0600` |
| Installer configuration | `/opt/orbitpage` |
| Backups | `/var/backups/orbitpage` |
| HTTP listener | `0.0.0.0:8080` (all IPv4 interfaces) |

### Available commands

```bash
sudo orbitpage status
sudo orbitpage logs
sudo orbitpage start
sudo orbitpage stop
sudo orbitpage restart
sudo orbitpage config
sudo orbitpage backup
sudo orbitpage update
sudo orbitpage uninstall
```

Backup, restore, rollback, and uninstall procedures are in [Maintenance](./maintenance.md).

### Installation options

Set overrides before running the installer:

```bash
sudo ORBITPAGE_HTTP_PORT=8090 \
  ORBITPAGE_PUBLIC_SITE_URL=https://page.example.com \
  ./install.sh
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORBITPAGE_HTTP_PORT` | `8080` | Host port |
| `ORBITPAGE_BIND_ADDRESS` | `0.0.0.0` | Host listener address; `127.0.0.1` limits access to the host |
| `ORBITPAGE_PUBLIC_SITE_URL` | Empty | Public HTTPS URL |
| `ORBITPAGE_IMAGE` | GHCR `latest` | Image tag or digest |
| `ORBITPAGE_DATA_DIR` | `/var/lib/orbitpage` | Data directory |
| `ORBITPAGE_CONTAINER_NAME` | `orbitpage` | Container name |
| `ORBITPAGE_REQUIRE_SETUP_TOKEN` | `false` for new installs | Host token for setup |

### LAN and loopback

New Linux and Proxmox installations listen on all IPv4 interfaces. To limit HTTP access to the Linux host or the Proxmox guest, set `ORBITPAGE_BIND_ADDRESS=127.0.0.1`:

```bash
# Linux
sudo ORBITPAGE_BIND_ADDRESS=127.0.0.1 ./install.sh

# Proxmox host, when creating the LXC
ORBITPAGE_BIND_ADDRESS=127.0.0.1 ./install-pve.sh
```

Existing Linux installations keep their saved bind address. To enable LAN access, rerun the current installer from its checkout:

```bash
sudo ORBITPAGE_BIND_ADDRESS=0.0.0.0 ./install.sh
```

Reinstalling keeps the data and secrets. In Proxmox, loopback refers to the LXC itself.

---

<a id="proxmox-ve-installer"></a>

## Proxmox VE

The installer creates a dedicated **unprivileged Debian 12 LXC** and installs OrbitPage inside it.

Use an x86-64 Proxmox VE 8+ host with patched `lxc-pve`: at least `6.0.0-2` on PVE 8, or `6.0.5-2` on PVE 9+. Run as `root`:

```bash
apt-get update
apt-get install -y git
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage
./install-pve.sh
```

| Resource | Default |
| --- | --- |
| CPU | 2 cores |
| RAM | 2048 MB |
| Swap | 512 MB |
| Disk | 12 GB |
| Network | `vmbr0`, DHCP |
| Container | Unprivileged Debian 12 LXC |
| Features | `nesting=1,keyctl=1` |

Docker, the database, uploads, and application secrets remain inside the LXC. HTTP is reachable on the guest's LAN address.

Open `http://GUEST_IP:8080/dashboard/profile` and choose a password for the admin. The public page is at `http://GUEST_IP:8080`. Use the LXC address shown by the installer for `GUEST_IP`.

### Customize the LXC

Set variables before running the script:

```bash
ORBITPAGE_PVE_MEMORY=4096 \
  ORBITPAGE_PVE_SSH_PUBLIC_KEY=/path/to/id_ed25519.pub \
  ./install-pve.sh
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORBITPAGE_PVE_CTID` | Next free cluster ID | New LXC ID |
| `ORBITPAGE_PVE_HOSTNAME` | `orbitpage` | Guest hostname |
| `ORBITPAGE_PVE_CORES` | `2` | CPU cores |
| `ORBITPAGE_PVE_MEMORY` | `2048` | RAM in MB |
| `ORBITPAGE_PVE_SWAP` | `512` | Swap in MB |
| `ORBITPAGE_PVE_DISK_GB` | `12` | Root disk size in GB |
| `ORBITPAGE_PVE_ROOTFS_STORAGE` | First active rootdir storage | Root disk storage |
| `ORBITPAGE_PVE_TEMPLATE_STORAGE` | First active vztmpl storage | Template storage |
| `ORBITPAGE_PVE_TEMPLATE` | Latest Debian 12 amd64 | Template filename |
| `ORBITPAGE_PVE_BRIDGE` | `vmbr0` | Network bridge |
| `ORBITPAGE_PVE_IP` | `dhcp` | DHCP or static IPv4 CIDR |
| `ORBITPAGE_PVE_GATEWAY` | Empty | Static IPv4 gateway |
| `ORBITPAGE_PVE_VLAN` | Empty | VLAN tag, 1–4094 |
| `ORBITPAGE_PVE_FIREWALL` | `1` | Network-interface firewall flag |
| `ORBITPAGE_PVE_SSH_PUBLIC_KEY` | Empty | Host path to a key authorized for guest root |
| `ORBITPAGE_HTTP_PORT` | `8080` | OrbitPage port inside the guest |
| `ORBITPAGE_BIND_ADDRESS` | `0.0.0.0` | Guest listener address; see [LAN and loopback](#lan-and-loopback) |
| `ORBITPAGE_PUBLIC_SITE_URL` | Empty | Public HTTPS URL |
| `ORBITPAGE_IMAGE` | GHCR `latest` | Image tag or digest |
| `ORBITPAGE_REQUIRE_SETUP_TOKEN` | `false` for new installs | Host token for setup |
| `ORBITPAGE_PVE_WAIT_ATTEMPTS` | `90` | Guest-start polling attempts |
| `ORBITPAGE_PVE_WAIT_SECONDS` | `2` | Seconds between attempts |

The firewall flag does not enable Proxmox firewall layers or add allow rules. If the Proxmox firewall is enabled, allow your HTTP port for LAN access.

---

<a id="reverse-proxy-notes"></a>

## Reverse proxy and HTTPS

Point your HTTPS reverse proxy at OrbitPage's HTTP address, such as `http://127.0.0.1:8080` when both run on the same host.

| Setting | What to configure |
| --- | --- |
| HTTPS | Use a valid certificate at the proxy |
| Public URL | Set `PUBLIC_SITE_URL` to your public HTTPS address |
| Forwarded headers | Pass the original host, protocol, and client IP: `Host`, `X-Forwarded-Proto`, `X-Forwarded-For` |
| Proxy trust | Set `ORBITPAGE_TRUST_PROXY` only to the trusted proxy addresses or CIDRs |
| Cache | Exclude `/api/*`, `/dashboard/*`, `/health`, and localized dashboard paths such as `/en-US/dashboard/*` |
| Uploaded media | Forward `/uploads/*` to OrbitPage |

For a proxy on the same host, you can restrict HTTP to [loopback](#lan-and-loopback). In Proxmox, a proxy inside the LXC can use `127.0.0.1`; a proxy on the PVE host uses the guest's LAN address.

`ENABLE_HTTPS=true` enables a self-signed listener and is usually unnecessary behind the proxy. See [Configuration](./Configuration.md#public-url-and-networking) for proxy variables and subdirectory hosting.

---

<a id="update-safely"></a>

## Updating OrbitPage

Back up before updating. Keep the existing data mount and secrets; use [Maintenance](./maintenance.md) for backup and rollback procedures.

### Linux and Proxmox

For installer-managed deployments using `latest`:

```bash
sudo orbitpage update
```

From the Proxmox host:

```bash
pct exec CTID -- orbitpage update
```

Pinned images stay pinned. To select a new digest, use `sudo ORBITPAGE_IMAGE=IMAGE@sha256:NEW_DIGEST orbitpage install` with the actual image and digest.

### Docker Compose updates

Run from the existing Compose project directory:

```bash
docker compose pull
docker compose up -d
```

<a id="manual-docker-or-compose-deployment"></a>

### Docker Run updates

Pull the new image and recreate the container with the **same volume, ports, and environment**. For the Docker Run example above:

```bash
docker pull paoloronco/orbitpage:latest

docker stop orbitpage
docker rm orbitpage

docker run -d \
  --name orbitpage \
  --restart unless-stopped \
  -p 8080:8080 \
  -v orbitpage-data:/app/data \
  --security-opt no-new-privileges:true \
  paoloronco/orbitpage:latest
```

Use your original settings if they differ. Removing the container keeps its named volume; do not delete the volume.

### Web updates

In **Account → General → Instance details**, click **Check for updates**, then **Install update…**. The Linux/Proxmox installer enables the host update service for official `latest` images on systemd hosts. Without that service, the dialog shows terminal instructions.

For an existing Docker Run or Compose container, install the service with:

```bash
git clone https://github.com/paoloronco/OrbitPage.git
sudo ./OrbitPage/install.sh web-updates orbitpage
```

Replace `orbitpage` with the actual container name. The service requires Python 3, systemd, an official `latest` image, and a writable persistent `/app/data` mount. Source installations, custom images, and pinned releases use terminal updates.

Dashboard installation requires an administrator's current password. OrbitPage does not receive the Docker socket or sudo access. If an update result is unconfirmed, inspect the service and retained backup as described in [Troubleshooting](./Troubleshooting.md#image-pull-or-dashboard-installation-fails).

### Verify the update

Run on the Docker host, or inside the LXC for Proxmox:

```bash
curl -fsS http://127.0.0.1:8080/health
```

Use your configured port if it differs. Also check dashboard login, the public page, and uploaded media.

---

## Next steps

- [Configuration](./Configuration.md): environment variables and application settings.
- [Maintenance](./maintenance.md): backups, restore, rollback, and removal.
- [Troubleshooting](./Troubleshooting.md): deployment and proxy issues.
- [Run from source](../../README.md#run-from-source): source installation.
