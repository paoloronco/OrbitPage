# Docker Hub namespace migration

The official OrbitPage Docker Hub image moved from `paueron/orbitpage` to
`paoloronco/orbitpage`. The former path is a compatibility feed only and stops
receiving updates at **2026-10-09 00:00 UTC**. The GHCR image remains
`ghcr.io/paoloronco/orbitpage`.

This change affects only the image reference. Reusing the same `/app/data`
volume or bind mount preserves the database, uploads, configuration and local
version history.

## Installer-managed deployment

For installations that follow `paueron/orbitpage:latest` (with or without the
`docker.io/` prefix), the normal update command creates a backup, automatically
changes the persisted image to `paoloronco/orbitpage:latest`, and recreates the
container:

```bash
sudo orbitpage update
sudo orbitpage status
```

Explicitly pinned legacy version tags are preserved. Move a pinned deployment
to the matching tag in the new namespace when you intentionally upgrade it:

```bash
sudo ORBITPAGE_IMAGE=paoloronco/orbitpage:X.Y.Z orbitpage install
```

Use the release number from [GitHub Releases](https://github.com/paoloronco/OrbitPage/releases)
without the Git tag's leading `v`.

If the bundled `orbitpage-update` command was installed from the former image,
replace the host command from the official image before running it. The old
`paueron/orbitpage:latest` feed may still contain a script that pulls from the
old namespace, so it cannot migrate itself:

```bash
tmp="$(mktemp)"
if sudo docker run --rm --pull=always --entrypoint cat \
  paoloronco/orbitpage:latest /app/orbitpage-update.sh > "$tmp" &&
  test -s "$tmp" && bash -n "$tmp"; then
  sudo install -m 0755 "$tmp" /usr/local/bin/orbitpage-update && sudo orbitpage-update
else
  echo "Could not extract the official updater; the installed command was not changed." >&2
fi
rm -f "$tmp"
sudo docker inspect orbitpage orbitpage-demo --format '{{.Name}} {{.Config.Image}}'
```

Both containers should now reference `paoloronco/orbitpage:latest`. Keep their
existing `orbitpage-data-prod` and `orbitpage-data-demo` volumes. The updated
command pulls the official image directly on future runs.

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
