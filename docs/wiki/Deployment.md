# Deployment

Docker is the recommended production deployment path for OrbitPage. It keeps the frontend build, backend runtime, SQLite database location, and upload directory consistent across hosts.

## One-command Linux install

The repository includes a production installer for an existing x86-64 Debian 12/13 or Ubuntu 22.04/24.04 server, VM, or LXC:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh | sudo bash
```

It performs the complete application setup:

- validates the operating system and architecture;
- refuses to modify a Proxmox VE host directly;
- installs Docker Engine and Compose v2 from Docker's official apt repository when needed;
- generates a 256-bit JWT secret without printing it;
- persists SQLite and uploaded media under `/var/lib/orbitpage`;
- stores secrets under `/etc/orbitpage` with owner-only permissions;
- starts the container with `no-new-privileges` and a health check;
- installs the `orbitpage` management command.

The default endpoint is `http://SERVER_IP:8080`. The initial administrator is created from `/dashboard/profile`.

### Installation options

Set options before the one-command installer:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh | \
  sudo ORBITPAGE_HTTP_PORT=8090 \
  ORBITPAGE_BIND_ADDRESS=127.0.0.1 \
  ORBITPAGE_PUBLIC_SITE_URL=https://links.example.com \
  bash
```

Supported overrides include:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ORBITPAGE_HTTP_PORT` | `8080` | Host HTTP port |
| `ORBITPAGE_BIND_ADDRESS` | `0.0.0.0` | Host interface; use `127.0.0.1` behind a local reverse proxy |
| `ORBITPAGE_PUBLIC_SITE_URL` | Empty | Canonical HTTPS URL |
| `ORBITPAGE_IMAGE` | `ghcr.io/paoloronco/orbitpage:latest` | Image or versioned tag to deploy |
| `ORBITPAGE_DATA_DIR` | `/var/lib/orbitpage` | Persistent database and media path |

Pin a release instead of following `latest` when deterministic upgrades are required:

```bash
curl -fsSL https://raw.githubusercontent.com/paoloronco/OrbitPage/main/install.sh | \
  sudo ORBITPAGE_IMAGE=ghcr.io/paoloronco/orbitpage:4.8.3 bash
```

### Operations

```bash
orbitpage status
orbitpage logs
orbitpage restart
orbitpage backup
orbitpage update
orbitpage config
```

`orbitpage update` first creates a consistent backup while the container is stopped, downloads the latest installer, pulls the configured image, recreates the service, and waits for the health check. Backups are stored in `/var/backups/orbitpage` by default.

Removal preserves data unless an explicit purge is requested:

```bash
orbitpage uninstall
orbitpage uninstall --purge
```

For Community Scripts integration, this installer is the guest-side application installer. A Community Scripts contribution still needs its standard `ct/`, `install/`, and metadata wrapper files in their development repository to provision the LXC itself. The wrapper should enable the container features required by Docker and invoke this script inside the guest.

## Images

The same image is published to both registries:

```bash
paueron/orbitpage:latest
ghcr.io/paoloronco/orbitpage:latest
```

Versioned tags are also published, for example:

```bash
paueron/orbitpage:4.3.7
paueron/orbitpage:v4.3.7
paueron/orbitpage:4.3.8
paueron/orbitpage:v4.3.8
paueron/orbitpage:4.3
```

## Minimal Docker Run

```bash
docker run -d --name orbitpage \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -v orbitpage_data:/app/data \
  paueron/orbitpage:latest
```

Open:

- Public page: <http://localhost:8080>
- Admin panel: <http://localhost:8080/dashboard/profile>

## Docker Compose

From the repository root:

```bash
docker compose up -d
```

Before exposing the app publicly, replace the sample `JWT_SECRET` in `docker-compose.yml`.

## Required Production Settings

```bash
NODE_ENV=production
PORT=8080
JWT_SECRET=replace-with-a-long-random-secret
```

Recommended when behind a proxy, CDN, tunnel, or managed cloud domain:

```bash
PUBLIC_SITE_URL=https://links.example.com
PUBLIC_SITE_NAME="Your Name or Brand"
```

## Persistent Data

Always persist `/app/data`.

It contains:

- `orbitpage.db`
- uploaded files
- runtime data needed across container upgrades

If `/app/data` is not persisted, a new container may start with an empty database.

## Generic Cloud Deployment

OrbitPage works on platforms that support Docker containers or Node.js services, including Cloud Run, Render, Fly.io, DigitalOcean App Platform, Azure App Service, Koyeb, Northflank, CapRover, Dokku, Coolify, and similar hosts.

For Docker-capable platforms:

1. Use the repository root `Dockerfile`, or pull `paueron/orbitpage:latest`.
2. Set `PORT=8080`.
3. Set a stable `JWT_SECRET`.
4. Persist `/app/data`.
5. Attach a public domain.
6. Let the platform provide HTTPS at the edge.

`ENABLE_HTTPS=true` starts a self-signed HTTPS listener and is usually not needed on managed platforms.

## Reverse Proxy Notes

When running behind Nginx, Caddy, Traefik, Cloudflare, or a platform proxy:

- forward the original host and protocol headers
- set `PUBLIC_SITE_URL` if the app receives internal hostnames
- keep WebSocket support available for local dev only; production does not require it
- do not cache `/api/*`
- keep `/uploads/*` publicly readable if uploaded images are used on the public page

## Updating

For Compose-based installs:

```bash
docker compose pull
docker compose up -d
```

For a named Docker volume:

```bash
docker pull paueron/orbitpage:latest
docker stop orbitpage
docker rm orbitpage
docker run -d --name orbitpage \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e JWT_SECRET="same-secret-as-before" \
  -v orbitpage_data:/app/data \
  paueron/orbitpage:latest
```

Keep the same `JWT_SECRET` across restarts to avoid invalidating active sessions unexpectedly.


