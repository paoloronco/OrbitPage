# Configuration

Lynx is configured through environment variables. Frontend `VITE_*` values are build-time settings; backend values are runtime settings.

## Production Essentials

| Variable | Default | Recommendation |
| --- | --- | --- |
| `JWT_SECRET` | random outside Docker | Required for Docker and production. Use a long random stable value. |
| `NODE_ENV` | unset | Set to `production` in production. |
| `PORT` | `3001` local, `8080` Docker | Set to the port your platform expects. |
| `DATA_DIR` | server directory local, `/app/data` Docker | Persist this directory in production. |
| `PUBLIC_SITE_URL` | derived from request | Set to the canonical public URL behind proxies or cloud platforms. |
| `PUBLIC_SITE_NAME` | `Lynx` | Set to your name, brand, or site label. |
| `SEO_INDEXING` | `true` | Set to `false` for staging/private deployments. |

## Runtime Variables

| Variable | Notes |
| --- | --- |
| `JWT_SECRET` | Signs admin JWT sessions. Docker startup aborts when missing. |
| `PORT` | HTTP listener port. |
| `DATA_DIR` | Stores `lynx.db` and uploads. |
| `FRONTEND_URL` | Optional development CORS/CSP origin. Leave unset for same-origin production. |
| `DEMO_MODE` | Disables destructive mutations and resets demo data. Not for normal production. |
| `ENABLE_HTTPS` | Enables a self-signed HTTPS listener. Usually unnecessary behind real HTTPS proxies. |
| `SSL_PORT` | HTTPS listener port when `ENABLE_HTTPS=true`. |
| `BASE_PATH` | Optional mount path, for example `/lynx`. |
| `PUBLIC_BASE_PATH` | Backward-compatible alias for `BASE_PATH`. |
| `PUBLIC_SITE_URL` | Canonical public URL used for metadata, sitemap, and social previews. |
| `PUBLIC_SITE_NAME` | Site name used in generated metadata. |
| `SEO_INDEXING` | `false`, `0`, `no`, or `off` disables indexing. |
| `RESET_TOKEN` | Enables token-protected reset endpoints. Use at least 32 characters. |

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
PUBLIC_SITE_URL=https://staging-links.example.com
SEO_INDEXING=false
```

## Base Path Deployments

Set `BASE_PATH` when Lynx is mounted below a path:

```bash
BASE_PATH=/lynx
```

With that setting, Lynx serves the app from both root and the base path:

- `/` and `/lynx`
- `/admin` and `/lynx/admin`
- `/api/...` and `/lynx/api/...`
- `/uploads/...` and `/lynx/uploads/...`
