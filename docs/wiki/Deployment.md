# Deployment

Docker is the recommended production deployment path for Lynx. It keeps the frontend build, backend runtime, SQLite database location, and upload directory consistent across hosts.

## Images

The same image is published to both registries:

```bash
paueron/lynx:latest
ghcr.io/paoloronco/lynx:latest
```

Versioned tags are also published, for example:

```bash
paueron/lynx:4.3.6
paueron/lynx:v4.3.6
paueron/lynx:4.3
```

## Minimal Docker Run

```bash
docker run -d --name lynx \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -v lynx_data:/app/data \
  paueron/lynx:latest
```

Open:

- Public page: <http://localhost:8080>
- Admin panel: <http://localhost:8080/admin>

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

- `lynx.db`
- uploaded files
- runtime data needed across container upgrades

If `/app/data` is not persisted, a new container may start with an empty database.

## Generic Cloud Deployment

Lynx works on platforms that support Docker containers or Node.js services, including Cloud Run, Render, Fly.io, DigitalOcean App Platform, Azure App Service, Koyeb, Northflank, CapRover, Dokku, Coolify, and similar hosts.

For Docker-capable platforms:

1. Use the repository root `Dockerfile`, or pull `paueron/lynx:latest`.
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
docker pull paueron/lynx:latest
docker stop lynx
docker rm lynx
docker run -d --name lynx \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e JWT_SECRET="same-secret-as-before" \
  -v lynx_data:/app/data \
  paueron/lynx:latest
```

Keep the same `JWT_SECRET` across restarts to avoid invalidating active sessions unexpectedly.
