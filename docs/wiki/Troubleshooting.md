# Troubleshooting

## Container Exits Immediately

Check whether `JWT_SECRET` is set. Docker production startup requires it.

```bash
docker logs orbitpage
```

Fix:

```bash
docker run -e JWT_SECRET="$(openssl rand -hex 32)" ...
```

## Data Disappeared After Updating

The container likely started without the same persisted data volume.

Make sure `/app/data` is mounted:

```bash
-v orbitpage_data:/app/data
```

For Compose, keep the `./orbitpage-data:/app/data` mount or migrate the old data directory before recreating the container.

## Admin Login Stops Working After Restart

If `JWT_SECRET` changes between restarts, existing JWTs become invalid. This is expected.

Fix:

- set a stable `JWT_SECRET`
- restart the container
- log in again

## Public Page Works but Admin/API Fails Behind a Proxy

Check that the proxy forwards API requests and does not cache them.

Do not cache:

```text
/api/*
/admin
/dashboard/*
/health
```

Also set:

```bash
PUBLIC_SITE_URL=https://your-public-domain.example
```

## Search Engines Index a Staging Site

Set:

```bash
SEO_INDEXING=false
```

Then check:

- `/robots.txt`
- page source for `noindex`

## Social Preview Shows the Wrong Domain

Set the canonical URL explicitly:

```bash
PUBLIC_SITE_URL=https://links.example.com
PUBLIC_SITE_NAME="Your Name or Brand"
```

Then refresh the preview in the relevant social platform debugger.

## Docker Image Pull Fails

Use one of the published image paths:

```bash
docker pull paueron/orbitpage:latest
docker pull ghcr.io/paoloronco/orbitpage:latest
```

Versioned examples:

```bash
docker pull paueron/orbitpage:4.3
docker pull ghcr.io/paoloronco/orbitpage:4.3
```

## Local Development Ports

Expected ports:

- Vite frontend: `8080`
- Express backend: `3001`
- Docker production: `8080`

If a port is busy, stop the conflicting process or override the relevant port.
