# Configuration

OrbitPage is configured through environment variables. Frontend `VITE_*` values are build-time settings; backend values are runtime settings.

## Production Essentials

| Variable | Default | Recommendation |
| --- | --- | --- |
| `JWT_SECRET` | random outside Docker | Required for Docker and production. Use a long random stable value. |
| `NODE_ENV` | unset | Set to `production` in production. |
| `PORT` | `3001` local, `8080` Docker | Set to the port your platform expects. |
| `DATA_DIR` | server directory local, `/app/data` Docker | Persist this directory in production. |
| `UPLOAD_STORAGE_QUOTA_MB` | `1024` | Keep local uploads bounded. Raise this only when the data volume is sized accordingly. |
| `VIDEO_UPLOAD_LIMIT_MB` | `100` | Maximum size for one uploaded MP4/WebM/GIF media file. |
| `PUBLIC_SITE_URL` | derived from request | Set to the canonical public URL behind proxies or cloud platforms. |
| `PUBLIC_SITE_NAME` | `OrbitPage` | Set to your name, brand, or site label. |
| `SEO_INDEXING` | `true` | Set to `false` for staging/private deployments. |

## Runtime Variables

| Variable | Notes |
| --- | --- |
| `JWT_SECRET` | Signs admin JWT sessions. Docker startup aborts when missing. |
| `PORT` | HTTP listener port. |
| `DATA_DIR` | Stores `orbitpage.db` and uploads. |
| `UPLOAD_STORAGE_QUOTA_MB` | Maximum total upload storage in MB. New uploads are rejected with `413` when exceeded. |
| `VIDEO_UPLOAD_LIMIT_MB` | Per-file limit for uploaded video/background media. Content is also validated by MIME, extension, and binary signature. |
| `FRONTEND_URL` | Optional development CORS/CSP origin. Leave unset for same-origin production. |
| `DEMO_MODE` | Disables destructive mutations and resets demo data. Not for normal production. |
| `ENABLE_HTTPS` | Enables a self-signed HTTPS listener. Usually unnecessary behind real HTTPS proxies. |
| `SSL_PORT` | HTTPS listener port when `ENABLE_HTTPS=true`. |
| `BASE_PATH` | Optional mount path, for example `/orbitpage`. |
| `PUBLIC_BASE_PATH` | Backward-compatible alias for `BASE_PATH`. |
| `PUBLIC_SITE_URL` | Canonical public URL used for metadata, sitemap, and social previews. |
| `PUBLIC_SITE_NAME` | Site name used in generated metadata. |
| `SEO_INDEXING` | `false`, `0`, `no`, or `off` disables indexing. |
| `RESET_TOKEN` | Enables token-protected reset endpoints. Use at least 32 characters. |
| `OPENAI_API_KEY` | Optional environment-based OpenAI key for OrbitPage AI. A key saved in the dashboard takes precedence. |
| `OPENAI_PAGE_AGENT_MODEL` | Optional default model. The dashboard defaults to `gpt-5.6-terra` and only accepts its supported model list. |
| `ORBITPAGE_SECRET_ENCRYPTION_KEY` | Optional separate stable secret (32+ characters) for encrypting a dashboard-saved OpenAI key. Falls back to `JWT_SECRET`. |

## OrbitPage AI

Administrators can configure OrbitPage AI from **Dashboard > OrbitPage AI** without adding an environment variable. The saved key is encrypted at rest, never returned by the settings API, and excluded from application backups. Keep `JWT_SECRET` stable across restarts, or set a separate stable `ORBITPAGE_SECRET_ENCRYPTION_KEY`.

For secret-manager or immutable-container deployments, set `OPENAI_API_KEY` instead. The dashboard reports that the key comes from `ENV`; it does not expose its value. A key stored from the dashboard takes precedence over the environment key until it is removed.

OrbitPage AI uses the OpenAI Responses API with storage disabled and strict structured output. Page mutations require a separate confirmation request, expire after ten minutes, and fail closed when the page revision or editor permissions changed.

## Build-Time Frontend Variables

| Variable | Notes |
| --- | --- |
| `VITE_BASE_PATH` | Dev-server equivalent of `BASE_PATH`; production uses runtime `BASE_PATH`. |
| `VITE_DEMO_MODE` | Exposes demo mode to the UI. |
| `VITE_ENABLE_USERCENTRICS_PRIVACY_PAGE` | Enables the optional public `/privacy` Usercentrics embed. |
| `VITE_USERCENTRICS_PRIVACY_POLICY_ID` | Usercentrics privacy policy ID. |
| `VITE_USERCENTRICS_PRIVACY_POLICY_LANGUAGE` | Language passed to the Usercentrics privacy policy script. |
| `VITE_DEFAULT_PRIVACY_POLICY_URL` | Default public Privacy Policy URL. |

## Example Production Environment

```bash
NODE_ENV=production
PORT=8080
JWT_SECRET=replace-with-a-long-random-secret
DATA_DIR=/app/data
UPLOAD_STORAGE_QUOTA_MB=1024
VIDEO_UPLOAD_LIMIT_MB=100
PUBLIC_SITE_URL=https://links.example.com
PUBLIC_SITE_NAME="Example Links"
SEO_INDEXING=true
```

## Example Staging Environment

```bash
NODE_ENV=production
PORT=8080
JWT_SECRET=replace-with-a-long-random-secret
DATA_DIR=/app/data
UPLOAD_STORAGE_QUOTA_MB=256
VIDEO_UPLOAD_LIMIT_MB=50
PUBLIC_SITE_URL=https://staging-links.example.com
SEO_INDEXING=false
```

## Base Path Deployments

Set `BASE_PATH` when OrbitPage is mounted below a path:

```bash
BASE_PATH=/orbitpage
```

With that setting, OrbitPage serves the app from both root and the base path:

- `/` and `/orbitpage`
- `/dashboard/<section>` and `/orbitpage/dashboard/<section>` (for example `profile`, `links`, or `theme`)
- `/admin` and `/orbitpage/admin` remain compatibility aliases
- `/api/...` and `/orbitpage/api/...`
- `/uploads/...` and `/orbitpage/uploads/...`
