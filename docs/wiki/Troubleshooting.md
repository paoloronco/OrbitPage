# Troubleshooting

## Container Exits Immediately

Check whether `JWT_SECRET` is set. Docker production startup requires it.

```bash
docker logs orbitpage
```

For an installer-managed deployment, confirm that the protected environment file exists and repair the installation without replacing its secret:

```bash
sudo test -s /etc/orbitpage/orbitpage.env
test "$(sudo stat -c '%a' /etc/orbitpage/orbitpage.env)" = '600'
sudo orbitpage install
```

For a manual deployment, create the root-owned `0600` environment file described in [Deployment](./Deployment.md#docker-image-recommended), then recreate the container with `--env-file`. Do not put `JWT_SECRET` in a `docker run -e` argument, tracked Compose file, or shell history.

## Data Disappeared After Updating

The container likely started without the same persisted data volume.

Make sure `/app/data` is mounted:

```bash
-v orbitpage_data:/app/data
```

For Compose, keep the `./orbitpage-data:/app/data` mount or migrate the old data directory before recreating the container.

## Admin Login Stops Working After Restart

If `JWT_SECRET` changes between restarts, existing JWTs become invalid. This is expected.

If the change was accidental, restore the previous `JWT_SECRET` from the protected configuration backup, recreate the container, and log in again. Do not rotate this secret merely to recover a login: it also protects encrypted TOTP and dashboard-saved provider secrets.

A changed environment file requires container recreation; `docker restart` does not reload it. See [Configuration](./Configuration.md) and the [restore runbook](./Deployment.md#restore-an-infrastructure-backup).

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

Immutable version examples:

```bash
docker pull paueron/orbitpage:v4.19.9
docker pull ghcr.io/paoloronco/orbitpage:v4.19.9
```

## Local Development Ports

Expected ports:

- Vite frontend: `8080`
- Express backend: `3001`
- Docker production: `8080`

If a port is busy, stop the conflicting process or override the relevant port.
