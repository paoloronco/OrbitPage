# Troubleshooting

Check status, logs, and the health endpoint for your installation before changing settings. Installation and update commands are in [Deployment](./Deployment.md).

> [!IMPORTANT]
> Keep the existing data and secrets. Do not delete the database, remove volumes, or regenerate `JWT_SECRET` to fix a startup problem. Use [Maintenance](./maintenance.md) for backup and restore procedures.

| Installation | Start here |
| --- | --- |
| Docker Run or GHCR | [Docker Run](#docker-run) |
| Docker Compose | [Docker Compose](#docker-compose) |
| Linux installer | [Linux installer](#linux-installer) |
| Proxmox VE installer | [Proxmox VE](#proxmox-ve) |
| Container hosting platform | [Container hosting platforms](#container-hosting-platforms) |
| Run from source | [Source installation](#source-installation) |

For other symptoms, see [networking](#networking-and-https), [public content](#public-page-and-content), [login](#login-and-setup), [storage](#storage-and-uploads), [updates](#updates), or [AI and newsletters](#ai-and-newsletters).

## Docker Run

Commands below use the container name `orbitpage`. Replace it if yours differs.

```bash
docker ps -a --filter name=orbitpage
docker logs --tail 100 orbitpage
docker port orbitpage
docker inspect orbitpage --format '{{json .Mounts}}'
```

### Container exits or keeps restarting

Inspect its state and the startup error:

```bash
docker inspect orbitpage --format '{{json .State}}'
docker logs --tail 200 orbitpage
```

Check that the data mount is writable and has free space. An explicit `JWT_SECRET` must have at least 32 characters and must not be a placeholder. Without one, Docker generates and saves it in `DATA_DIR/.jwt-secret` (`/app/data/.jwt-secret` by default).

A port conflict can prevent Docker from starting the container before application logs exist. See [Networking](#networking-and-https).

### Data disappeared after recreation

Compare the current mount with the original deployment. The replacement must use the same volume or host directory at `/app/data`; the Docker Run example uses `orbitpage-data`.

```bash
docker volume ls
docker volume inspect orbitpage-data
```

If the original volume still exists, recreate the container with that mount and the original settings. An empty new volume starts a separate installation. If data was deleted, use [Restore](./maintenance.md#restore-an-infrastructure-backup).

### Environment or port changes are ignored

`docker restart orbitpage` keeps the container's existing settings. Recreate it after changing an environment file, port mapping, or mount. Keep the original data mount and secrets; use the [Docker Run procedure](./Deployment.md#docker-run-updates).

## Docker Compose

Run commands from the original project directory, using the same Compose file and project name as installation.

```bash
docker compose ps
docker compose logs --tail 100 orbitpage
docker compose port orbitpage 8080
docker compose ps -q orbitpage
```

Use the container ID from the last command to inspect its mount:

```bash
docker inspect CONTAINER_ID --format '{{json .Mounts}}'
```

| Problem | Check or fix |
| --- | --- |
| No service or container found | Check the project directory, Compose file, and any original `-f` or `-p` options. |
| Data appears empty | The repository uses `./orbitpage-data`, relative to the Compose file's directory. A copied checkout can point to a different data directory. |
| `.env` values are ignored | Add `env_file: .env` under the service. A project `.env` alone supplies Compose interpolation, not the container's environment. |
| Settings changed but the old values remain | Recreate the service below. Dashboard overrides can also take precedence; see [Configuration](./Configuration.md#dashboard-environment-overrides). |

After editing the configuration:

```bash
docker compose up -d --force-recreate orbitpage
```

Keep the existing storage path. For updates, use [Docker Compose updates](./Deployment.md#docker-compose-updates).

## Linux installer

```bash
sudo orbitpage status
sudo orbitpage config
sudo orbitpage logs
```

`logs` follows output until you press `Ctrl+C`. `config` shows the saved address, port, image, and paths without printing secret values.

| Purpose | Default path |
| --- | --- |
| Persistent data | `/var/lib/orbitpage` |
| Runtime environment | `/etc/orbitpage/orbitpage.env` |
| Installer configuration | `/opt/orbitpage` |
| Backups | `/var/backups/orbitpage` |

### OrbitPage does not start

Read the application error, then check the protected environment file:

```bash
sudo test -s /etc/orbitpage/orbitpage.env
sudo stat -c '%a' /etc/orbitpage/orbitpage.env
```

The expected file mode is `600`. Restore missing configuration from its backup. To repair an existing installer-managed deployment:

```bash
sudo orbitpage install
```

This preserves existing data and the secret. To use a newer installer, run `sudo ./install.sh` from an updated checkout.

### Works locally but not on the LAN

Check the address and port with `sudo orbitpage config`. New installations use `0.0.0.0:8080`; existing installations retain their saved address. To change a loopback-only installation, run from the current checkout:

```bash
sudo ORBITPAGE_BIND_ADDRESS=0.0.0.0 ./install.sh
```

If the address is already reachable, check the host firewall and network. See [LAN and loopback](./Deployment.md#lan-and-loopback).

## Proxmox VE

Run these commands on the PVE host. Replace `CTID` with the OrbitPage LXC ID shown by `pct list`.

```bash
pct list
pct status CTID
pct config CTID
pct exec CTID -- orbitpage status
pct exec CTID -- orbitpage config
pct exec CTID -- orbitpage logs
```

If the guest is stopped, start it with `pct start CTID`. To find its address and check OrbitPage inside it:

```bash
pct exec CTID -- ip -4 addr
pct exec CTID -- curl -fsS --max-time 10 http://127.0.0.1:8080/health
```

Use the configured port if it differs.

| Problem | Check or fix |
| --- | --- |
| LXC cannot be created | Check the [host requirements](./Deployment.md#proxmox-ve), free storage with `pvesm status`, available CT IDs with `pct list`, and the selected bridge with `ip link show`. |
| Guest has no IP or network access | Check DHCP/static addressing, bridge, gateway, and VLAN in `pct config CTID`. Defaults are `vmbr0` and DHCP. |
| Health works inside the guest but not from the LAN | Check the guest listener and Proxmox firewall rules for the configured TCP port. The default `firewall=1` flag does not add allow rules. |
| A proxy on the PVE host cannot connect | Use the guest's LAN address. `127.0.0.1` on the PVE host refers to the host, not the LXC. |
| Data or configuration seems missing | Linux installer paths are inside the guest. Check them with `pct exec CTID -- orbitpage config`. |

For repair or listener changes, follow the [Linux section](#linux-installer) inside the guest. Update commands are in [Linux and Proxmox updates](./Deployment.md#linux-and-proxmox).

## Container hosting platforms

Check these settings in the provider dashboard:

| Setting | Required configuration |
| --- | --- |
| Storage | Writable persistent volume at `/app/data`, retained across redeployments. Ephemeral storage loses data when the container is replaced. |
| Replicas | One OrbitPage instance. Do not share the SQLite data volume between multiple replicas. |
| Listener | Match the published port to `PORT` and keep `HOST=0.0.0.0` inside the container. The image defaults to port `8080`. |
| Health check | HTTP `/health` on the application's configured port. |
| Public access | Check the domain, HTTPS termination, routing, and firewall separately from the health check. |

If deployment succeeds but OrbitPage is empty, inspect the attached volume before running setup again.

## Source installation

See [Run from source](../../README.md#run-from-source) for the built application and [Development](./Development.md#run-with-live-reload) for Vite with a separate backend.

### Backend rejects `JWT_SECRET`

Source installations do not use the Docker entrypoint. Set a stable random secret in `app/.env` as described in the source guide. It must have at least 32 characters; placeholder values are rejected.

The temporary development fallback changes between processes. It is unsuitable for persistent sessions, TOTP, or encrypted credentials.

### Environment settings or frontend changes are ignored

Start the backend from `app/server`:

```bash
node --env-file=../.env server.js
```

`npm run start` alone does not load `app/.env`. Host environment values take precedence over the file; saved dashboard overrides take precedence over both. See [Configuration](./Configuration.md).

Restart after server changes. Rebuild from `app/` with `npm run build` after frontend changes or changes to `VITE_*` variables. A published Docker image requires a new build to change its frontend variables.

| Symptom | Check |
| --- | --- |
| Backend is only reachable locally | Source `HOST` defaults to `127.0.0.1`. Set `HOST=0.0.0.0` in `app/.env` if LAN access is needed. |
| Port conflict | The built source example uses `8080`. Without an explicit `PORT`, Express uses `3001`. |
| Vite opens but API calls fail | Start both development processes. Vite uses port `8080` and proxies `/api` to Express on `3001`; check the backend port and logs. |

## Networking and HTTPS

Check health directly before testing the public domain. Run on the Docker/Linux host, or inside the Proxmox guest:

```bash
curl -fsS --max-time 10 http://127.0.0.1:8080/health
```

A successful response contains `"status":"ok"` and the running version. Use the actual port; for a remote check, replace `127.0.0.1` with the device's LAN address.

| Symptom | Check or fix |
| --- | --- |
| Port already in use | On Linux, run `sudo ss -lntp 'sport = :8080'`. Change Docker's host mapping to `8081:8080`, or the installer's `ORBITPAGE_HTTP_PORT`. |
| Health works locally but not remotely | Check the published port, bind address, host/provider firewall, and guest networking. |
| Domain does not reach the instance | Check DNS and the proxy target against the working direct address. |
| `502` or `504` from the proxy | Test health from the proxy host/container. Check upstream address, port, reachability, and proxy timeouts. |
| Dashboard, API, or media fails through the proxy | Forward `/api/*`, `/dashboard/*`, localized dashboard paths, `/uploads/*`, and `/health`. Check browser Network errors. |
| Wrong protocol, redirects, or client IP | Forward `Host`, `X-Forwarded-Proto`, and `X-Forwarded-For`. Trust only the actual proxy addresses/CIDRs with `ORBITPAGE_TRUST_PROXY`. |

Exclude API, dashboard, localized dashboard, and health responses from proxy caching. With a URL mount path, include it in `PUBLIC_SITE_URL` and set `BASE_PATH`. See [Reverse proxy and HTTPS](./Deployment.md#reverse-proxy-and-https).

## Public page and content

| Symptom | Check or fix |
| --- | --- |
| Old or missing content | Save the edited section, then check block visibility, schedules, and additional-page publication. Preview can include unsaved changes. |
| Content is saved but the public page stays stale | Inspect `curl -I https://page.example.com/` for `Age`, `CF-Cache-Status`, or `X-Cache`. Purge the affected proxy/CDN cache. |
| Wrong domain in QR codes, previews, or newsletter links | Set `PUBLIC_SITE_URL`, including any mount path, then restart/recreate as required. Check saved dashboard overrides if the host value is ignored. |
| An exported QR image still uses the old address | Generate it again; changing the configuration cannot alter an existing image. |
| Social preview remains old | Refresh the social platform's cached preview after correcting the page metadata. |
| A staging page appears in search results | Set `SEO_INDEXING=false`, then check `/robots.txt` and robots metadata. Existing results may take time to disappear. Indexing controls do not restrict access. |

See [Publishing and QR](./dashboard/publishing.md) and [SEO and indexing](./SEO-and-indexing.md).

## Login and setup

### Login stops working after restart

Check whether the data mount or `JWT_SECRET` changed. A changed secret invalidates sessions and can make TOTP, AI keys, or SMTP credentials unreadable when their encryption uses that secret.

Restore the original secret from its protected backup, apply it through the original deployment method, and sign in again. For a lost password or authenticator, use [Administrator recovery](./recovery.md).

### Setup asks for a token

If `REQUIRE_SETUP_TOKEN` is enabled, read the token on the host and enter it in the setup wizard:

| Installation | Command |
| --- | --- |
| Docker Run | `docker exec orbitpage cat /app/data/.setup-token` |
| Docker Compose | `docker compose exec orbitpage cat /app/data/.setup-token` |
| Linux installer | `sudo cat /var/lib/orbitpage/.setup-token` |
| Proxmox host | `pct exec CTID -- cat /var/lib/orbitpage/.setup-token` |

Use the actual container name or data path if customized. Keep the token private. See [Setup-token configuration](./Deployment.md#optional-setup-token).

## Storage and uploads

For disk or SQLite errors, check the data path. On Linux, check disk space and available inodes:

```bash
df -h
df -i
```

For Docker storage usage, run `docker system df`. For Linux installations, `sudo du -sh /var/lib/orbitpage` shows data usage. For manual bind mounts, use the actual directory shown by `docker inspect`.

Check that the mount is writable, with ownership and permissions suitable for the application process. Back up before database repair; keep SQLite sidecars and hidden secret/configuration files with the database.

| Symptom | Check or fix |
| --- | --- |
| Upload returns `413` | Check total upload quota, video size, and the proxy's request-body limit. For NGINX, check `client_max_body_size`. |
| Upload is rejected before reaching OrbitPage | Check proxy logs and upload limits; the application may have no matching log entry. |
| Backup import/export exceeds its media limit | Check `ORBITPAGE_BACKUP_MEDIA_LIMIT_MB`; see [Configuration](./Configuration.md). |
| Files disappear after cleanup | Check whether the files were unused and eligible for [automatic cleanup](./dashboard/backups-and-demo-mode.md#clean-unused-media). Restore from a verified backup if needed. |

## Updates

### Image pull or dashboard installation fails

Use `paoloronco/orbitpage:latest` or `ghcr.io/paoloronco/orbitpage:latest`. Pinned versions use `X.Y.Z`, without a leading `v`. If a pull fails, check the exact tag, registry connectivity, and Docker disk space.

Dashboard installation needs the [host update service](./Deployment.md#web-updates). Terminal instructions are expected for source deployments, custom/pinned images, or hosts without the service.

For the default container name, inspect the service on the Docker/Linux host:

```bash
sudo systemctl status orbitpage-updates-orbitpage.service
sudo journalctl -u orbitpage-updates-orbitpage.service -n 100 --no-pager
```

Replace the final `orbitpage` in the service name if using a custom container name. In Proxmox, run these checks inside the guest.

### Update result is unclear

Check status, logs, and `/health` before retrying. Compare the returned version with the expected release; also verify dashboard login, public content, and uploaded media.

Host-updater backups are retained under `/var/backups/orbitpage`. Inspect them and the service error before retrying. Use [Deployment](./Deployment.md#updating-orbitpage) for update commands and [Maintenance](./maintenance.md#roll-back-an-update) for rollback.

## AI and newsletters

| Problem | Check |
| --- | --- |
| AI provider error | Key, supported model, provider access, and outbound HTTPS. A key saved in AI Assistant takes precedence over `OPENAI_API_KEY`. |
| AI proposal expired or the page changed | Generate a new proposal from the current page. |
| Newsletter connection or delivery fails | SMTP host, TLS port, credentials, authorized sender, provider limits, and outbound connectivity. Private-network SMTP destinations are blocked. Use **Newsletter → Settings → Verify and send test**. |

See [AI assistant](./ai-assistant.md#problems) and [Newsletters](./dashboard/newsletters.md#backups-and-problems).

## Report a problem

Include the installation method, OrbitPage version, relevant error, and steps to reproduce. For networking issues, include the direct `/health` result and the public HTTP status.

Use the status/log commands in your installation's section. For Docker, also collect the image name with `docker inspect orbitpage --format '{{.Config.Image}}'`; for Compose, use its container ID.

Before sharing, remove secrets, tokens, cookies, SMTP credentials, and private account/page data. Do not post complete environment files or unredacted `docker inspect` / `docker compose config` output.
