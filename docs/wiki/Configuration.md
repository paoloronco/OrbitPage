# Configuration

OrbitPage can be configured through environment variables.

There are two main types of configuration:

- **Server variables** — loaded when the backend starts.
- **Frontend `VITE_*` variables** — embedded when the frontend is built.

## Configure from the dashboard (recommended)

Administrators can open **Account → General → Instance details → Environment variables** to set:

- `PUBLIC_SITE_URL`, `PUBLIC_SITE_NAME`, and `SEO_INDEXING`;
- `UPLOAD_STORAGE_QUOTA_MB`, `VIDEO_UPLOAD_LIMIT_MB`, and `MEDIA_CLEANUP_ENABLED`;
- `TZ` and `OPENAI_API_KEY`.

Existing values are hidden. Enter a replacement, or select **Use host** to remove a dashboard override. Save with your current password, then restart the instance to apply the changes.

### Dashboard environment overrides

Dashboard overrides take precedence over values supplied by `.env`, Docker, or the host. Removing an override restores the host value after restart.

Use manual configuration for listener, storage, authentication, proxy, and encryption settings.

### Where dashboard overrides are stored

Overrides are saved in `DATA_DIR/.instance-env.json` with owner-only permissions. The file can contain an OpenAI key in plaintext; keep it and its backups private.

## Set manually

### Source installation

From the repository root, copy the example environment file:

```bash
cp app/.env.example app/.env
chmod 600 app/.env
```

Then edit:

```text
app/.env
```

Keep environment files containing secrets private and out of Git.

See [Getting started](./Getting-started.md) for the complete installation procedure, including the required source `JWT_SECRET`.

### How `.env` is loaded

The frontend uses `app/.env` during the Vite build. The backend is started from `app/server` with:

```bash
node --env-file=../.env server.js
```

This loads the environment file before the server initializes. Environment variables already defined by the operating system or service manager take precedence over values in `.env`.

Restart the server after editing its settings. Rebuild the frontend after changing `VITE_*` variables.

> [!NOTE]
> Running `npm run start` directly does **not** automatically load `app/.env` into the backend.

<a id="apply-host-settings"></a>

### Docker and installers

- **Docker Run:** pass the file with `--env-file .env`.
- **Docker Compose:** add `env_file: .env` under the `orbitpage` service. A `.env` beside `docker-compose.yml` alone does not pass its values to the container.
- **Linux and Proxmox installers:** edit `/etc/orbitpage/orbitpage.env` on the Linux host or inside the LXC.

Recreate the container after editing an environment file; `docker restart` does not reload it. The published Docker image already contains the frontend build, so runtime `VITE_*` values do not change it.

Docker port mappings and volume mounts are configured in Docker Run or Compose, separately from the server's `PORT` and `DATA_DIR`. See [Deployment](./Deployment.md) for commands.

<a id="server-and-storage"></a>
<a id="public-url-and-networking"></a>
<a id="ai-smtp-and-recovery-secrets"></a>
<a id="frontend-build-settings"></a>

## Variables

Defaults below are the application's fallback values. The source `.env.example` sets `NODE_ENV=production` and `PORT=8080`.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | Unset from source; `production` in Docker | Runtime environment. Use `production` for deployed source installations. |
| `PORT` | `3001` from source; `8080` in Docker | HTTP listener port. |
| `HOST` | `127.0.0.1` from source; `0.0.0.0` in Docker | Address used by the HTTP and optional HTTPS listeners. |
| `DATA_DIR` | `app/server` from source; `/app/data` in Docker | Persistent directory containing SQLite data, uploads, and instance settings. Relative paths resolve from the server's working directory. |
| `JWT_SECRET` | Generated and persisted by the Docker entrypoint | Main signing secret. Required from source outside development/test; at least 32 characters, with placeholders rejected. |
| `REQUIRE_SETUP_TOKEN` | `false` | Requires the host-generated `.setup-token` during initial administrator setup. See [Deployment](./Deployment.md#optional-setup-token). |
| `UPLOAD_STORAGE_QUOTA_MB` | `1024` | Maximum total storage for uploads, in MB. Excess uploads return `413`. |
| `VIDEO_UPLOAD_LIMIT_MB` | `100` | Maximum size of an individual MP4, WebM, or GIF upload, in MB. |
| `ORBITPAGE_BACKUP_MEDIA_LIMIT_MB` | `128` | Maximum total decoded media size during one backup export or restore, in MB. |
| `MEDIA_CLEANUP_ENABLED` | Enabled outside tests/demo | Set to `false` to disable automatic removal of unused uploaded files. |
| `MEDIA_CLEANUP_GRACE_HOURS` | `24` | Minimum age of unused files before deletion, in hours; bounded to 1–720. |
| `TZ` | `UTC` | Fallback IANA timezone for scheduled content. |
| `DEMO_MODE` | Disabled | Enables automatic restoration of disposable demo data. Pair with `VITE_DEMO_MODE`. |
| `PUBLIC_SITE_URL` | Request origin | Public URL used for metadata, QR codes, sitemaps, and newsletter links. Include the mount path if used. |
| `SITE_URL` | Unset | Legacy alias for `PUBLIC_SITE_URL`; the current name takes precedence. |
| `PUBLIC_SITE_NAME` | `OrbitPage` | Site name used in generated metadata. |
| `SEO_INDEXING` | `true` | Allows search-engine indexing. `false`, `0`, `no`, or `off` disables it. |
| `BASE_PATH` | Empty | Optional URL mount path, for example `/orbitpage`. Root routes remain available. |
| `PUBLIC_BASE_PATH` | Unset | Legacy alias for `BASE_PATH`; prefer `BASE_PATH`. |
| `ORBITPAGE_TRUST_PROXY` | Disabled | Trusted proxy IPs/CIDRs or named ranges: `loopback`, `linklocal`, `uniquelocal`. Boolean values and hop counts are rejected. |
| `ORBITPAGE_ALLOWED_ORIGINS` | Unset | Adds trusted browser origins, separated by commas. Leave unset for same-origin use. |
| `FRONTEND_URL` | Unset | Optional separate frontend origin for development CORS/CSP. |
| `ORBITPAGE_API_RATE_LIMIT_MAX` | `300` | Maximum API requests per IP every 15 minutes, capped at 10000. Authentication uses stricter limits. |
| `ENABLE_HTTPS` | Disabled | Enables the optional self-signed HTTPS listener. |
| `SSL_PORT` | `8443` | Port used by the optional HTTPS listener. |
| `OPENAI_API_KEY` | Unset | Optional OpenAI key. A key saved in AI Assistant takes precedence. |
| `OPENAI_PAGE_AGENT_MODEL` | `gpt-5.6-terra` | Default page-agent model. Supported: `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-5.6-luna`. |
| `ORBITPAGE_SECRET_ENCRYPTION_KEY` | `JWT_SECRET` | Stable secret of at least 32 characters for an AI key saved in AI Assistant. |
| `NEWSLETTER_SECRET_KEY` | `JWT_SECRET` | Stable secret of at least 32 characters for SMTP encryption and newsletter links. |
| `RESET_TOKEN` | Unset | Temporary administrator recovery token; at least 32 random characters. Also authorizes destructive resets. Set only during [recovery](./recovery.md). |
| `VITE_BASE_PATH` | Empty | Frontend base path for development. Production uses server `BASE_PATH`. |
| `VITE_DEMO_MODE` | Disabled | Enables the demo UI; must match server `DEMO_MODE`. |
| `VITE_ORBITPAGE_HOSTED_MODE` | Disabled | Hosted frontend mode. Leave disabled for self-hosted use; hosted builds use the dedicated package scripts. |

Keep `DATA_DIR` persistent and signing/encryption secrets unchanged across restarts and updates.

Configure SMTP in **Newsletter → Settings**. See [Newsletters](./newsletters.md) and [AI assistant](./ai-assistant.md) for their setup. For staging, use a separate data directory and secret and set `SEO_INDEXING=false`.
