# Docker Hub namespace migration

The official OrbitPage Docker Hub image moved from `paueron/orbitpage` to
`paoloronco/orbitpage`. The former path is a compatibility feed only and stops
receiving updates at **2026-10-09 00:00 UTC**. The GHCR image remains
`ghcr.io/paoloronco/orbitpage`.

This change affects only the image reference. Reusing the same `/app/data`
volume or bind mount preserves the database, uploads, configuration and local
version history.

## Installer-managed deployment

The installer validates the existing data path, updates the persisted image
setting and recreates the container:

```bash
sudo ORBITPAGE_IMAGE=docker.io/paoloronco/orbitpage:latest orbitpage install
sudo orbitpage status
```

If the bundled `orbitpage-update` command was installed from the former image,
running it once after the compatibility release self-updates the script and
switches its default image to `paoloronco/orbitpage`:

```bash
sudo orbitpage-update
```

## Docker Compose

Replace the image in the Compose file and recreate only the OrbitPage service:

```yaml
services:
  orbitpage:
    image: paoloronco/orbitpage:latest
```

```bash
docker compose pull orbitpage
docker compose up -d --no-deps orbitpage
docker compose ps orbitpage
```

## Plain Docker

Record the current mounts, ports and environment source before recreating the
container. Pull `paoloronco/orbitpage:latest`, then recreate the container with
the same settings and persistent `/app/data` mount. Do not remove the volume or
data directory.

The dashboard can identify compatibility images and links to this procedure.
It cannot safely rewrite a host Compose file or recreate its own container:
OrbitPage deliberately has no access to the host Docker socket.

## Verify and roll back

```bash
docker inspect orbitpage --format '{{.Config.Image}}'
curl --fail http://127.0.0.1:8080/health
docker logs --tail 50 orbitpage
```

The inspected image should be `paoloronco/orbitpage:latest` (or an immutable
version tag). If verification fails, restore the previous image reference and
recreate the container with the same data mount; the migration does not alter
stored data.
