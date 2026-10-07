# Configuration

Backend environment variables apply when the server starts. Frontend `VITE_*` variables apply during the build.

For source installations, copy [app/.env.example](../../app/.env.example) to `app/.env` and follow [Getting started](./Getting-started.md). Vite reads it during the frontend build; `node --env-file=../.env server.js`, run from `app/server`, loads it before server initialization. Values already set in the host environment take precedence. Restart after editing server settings; `npm run start` does not load this file automatically.

## Dashboard environment overrides

Administrators can open **Account → General → Instance details → Environment variables** to change:

- `PUBLIC_SITE_URL`, `PUBLIC_SITE_NAME`, `SEO_INDEXING`;
- `UPLOAD_STORAGE_QUOTA_MB`, `VIDEO_UPLOAD_LIMIT_MB`, `MEDIA_CLEANUP_ENABLED`;
- `TZ` and `OPENAI_API_KEY`.

The dialog shows whether values are configured, without revealing them. Replacing or removing an override requires the current password.

Overrides live in `DATA_DIR/.instance-env.json`, with owner-only permissions. Restart the instance to apply them. They override the host environment; removing an override restores the host value after restart. Protect this file and its backups: an environment-based API key is stored there as plaintext.

Listener, storage, authentication, proxy, and encryption settings are changed on the host, not in this dialog.

## Server and storage

| Variable | Default | Meaning |
| --- | --- | --- |
| `NODE_ENV` | Unset from source; `production` in Docker | Set to `production` for a deployed source server |
| `PORT` | `3001` from source; `8080` in Docker | HTTP port |
| `HOST` | `127.0.0.1` from source; `0.0.0.0` in Docker | HTTP and optional HTTPS listener address |
| `DATA_DIR` | `app/server` from source; `/app/data` in Docker | SQLite, uploads, and saved instance settings |
| `JWT_SECRET` | Generated and saved by the Docker entrypoint | Required from source outside development/test; at least 32 characters, with placeholders rejected |
| `REQUIRE_SETUP_TOKEN` | `false` | Require the host's `.setup-token` during administrator setup |
| `UPLOAD_STORAGE_QUOTA_MB` | `1024` | Total upload storage limit in MB; excess uploads return `413` |
| `VIDEO_UPLOAD_LIMIT_MB` | `100` | Per-file MP4/WebM/GIF upload limit in MB |
| `ORBITPAGE_BACKUP_MEDIA_LIMIT_MB` | `128` | Total decoded media limit per export or restore in MB |
| `MEDIA_CLEANUP_ENABLED` | Enabled outside tests/demo | Set to `false` to disable automatic unused-upload cleanup |
| `MEDIA_CLEANUP_GRACE_HOURS` | `24` | Minimum unused-file age; bounded to 1–720 hours |
| `TZ` | `UTC` | Fallback IANA timezone for scheduled content |
| `DEMO_MODE` | Disabled | Periodically restore disposable demo data; pair with `VITE_DEMO_MODE` |

Keep `DATA_DIR` persistent and `JWT_SECRET` unchanged across restarts. Development/test fallback secrets are temporary. [Getting started](./Getting-started.md) shows source setup; [Deployment](./Deployment.md#optional-setup-token) covers setup-token use.

## Public URL and networking

| Variable | Default | Meaning |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | Request origin | Public URL for metadata, QR, sitemap, and newsletter links; include the mount path |
| `PUBLIC_SITE_NAME` | `OrbitPage` | Site name in generated metadata |
| `SEO_INDEXING` | `true` | `false`, `0`, `no`, or `off` disables indexing |
| `BASE_PATH` | Empty | Mount path, such as `/orbitpage` |
| `ORBITPAGE_TRUST_PROXY` | Disabled | Comma-separated proxy IPs/CIDRs or `loopback`, `linklocal`, `uniquelocal`; booleans and hop counts are rejected |
| `ORBITPAGE_ALLOWED_ORIGINS` | Unset | Additional trusted browser origins; leave unset for same-origin use |
| `FRONTEND_URL` | Unset | Optional separate frontend origin for development CORS/CSP |
| `ORBITPAGE_API_RATE_LIMIT_MAX` | `300` | Per-IP requests per 15 minutes, capped at 10000; authentication keeps stricter limits |
| `ENABLE_HTTPS` | Disabled | Start an optional self-signed HTTPS listener |
| `SSL_PORT` | `8443` | Port for that HTTPS listener |

`SITE_URL` remains an alias for `PUBLIC_SITE_URL`; `PUBLIC_BASE_PATH` remains an alias for `BASE_PATH`. Prefer the current names.

With `BASE_PATH=/orbitpage`, public, dashboard, API, and upload paths also work under `/orbitpage`; root paths remain available. Production asset paths are adapted by Express.

## AI, SMTP, and recovery secrets

| Variable | Default | Meaning |
| --- | --- | --- |
| `OPENAI_API_KEY` | Unset | Optional OpenAI key; a key saved in AI Assistant takes precedence |
| `OPENAI_PAGE_AGENT_MODEL` | `gpt-5.6-terra` | Default model; supported options are `gpt-5.6-terra`, `gpt-5.6-sol`, and `gpt-5.6-luna` |
| `ORBITPAGE_SECRET_ENCRYPTION_KEY` | `JWT_SECRET` | Separate stable secret of at least 32 characters for a dashboard-saved AI key |
| `NEWSLETTER_SECRET_KEY` | `JWT_SECRET` | Separate stable secret of at least 32 characters for SMTP encryption and email links |
| `RESET_TOKEN` | Unset | Temporary host-owner recovery secret; use a random value of at least 32 characters |

Configure SMTP in **Newsletter → Settings**, not with environment variables. See [AI assistant](./ai-assistant.md) and [Newsletters](./newsletters.md).

`RESET_TOKEN` authorizes both administrator recovery and a separate destructive reset. Use the [administrator recovery procedure](./recovery.md); leave the token unset outside recovery.

## Frontend build settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_BASE_PATH` | Empty | Base path for frontend development; production uses server `BASE_PATH` |
| `VITE_DEMO_MODE` | Disabled | Demo UI; must match server `DEMO_MODE` |
| `VITE_ORBITPAGE_HOSTED_MODE` | Disabled | Shared hosted frontend build; use the dedicated package scripts |

Changing these values requires rebuilding the frontend.

## Apply host settings

Store secrets in a protected environment file or the host's secret store. A minimal Docker environment file can contain:

```dotenv
PUBLIC_SITE_URL=https://page.example.com
PUBLIC_SITE_NAME=My page
SEO_INDEXING=true
```

Pass it with Docker `--env-file` or Compose `env_file`. Recreate the container after editing it: `docker restart` does not reload environment files. Source services must receive the same settings through their service manager and restart.

For staging, use a separate data directory and secret and set `SEO_INDEXING=false`.
