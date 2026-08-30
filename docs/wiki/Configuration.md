# Configuration

OrbitPage is configured through environment variables. Frontend `VITE_*` values are build-time settings; backend values are runtime settings.

## Production Essentials

| Variable | Default | Recommendation |
| --- | --- | --- |
| `JWT_SECRET` | ephemeral only in development/test | Required for every production runtime. Use a stable random value of at least 32 characters. Known placeholders are rejected. |
| `NODE_ENV` | unset | Set to `production` in production. |
| `PORT` | `3001` local, `8080` Docker | Set to the port your platform expects. |
| `DATA_DIR` | server directory local, `/app/data` Docker | Persist this directory in production. |
| `UPLOAD_STORAGE_QUOTA_MB` | `1024` | Keep local uploads bounded. Raise this only when the data volume is sized accordingly. |
| `VIDEO_UPLOAD_LIMIT_MB` | `100` | Maximum size for one uploaded MP4/WebM/GIF media file. |
| `ORBITPAGE_BACKUP_MEDIA_LIMIT_MB` | `128` | Maximum decoded media size in one backup export or restore. |
| `PUBLIC_SITE_URL` | derived from request | Set to the canonical public URL behind proxies or cloud platforms. |
| `PUBLIC_SITE_NAME` | `OrbitPage` | Set to your name, brand, or site label. |
| `SEO_INDEXING` | `true` | Set to `false` for staging/private deployments. |

## Runtime Variables

| Variable | Notes |
| --- | --- |
| `JWT_SECRET` | Signs admin JWT sessions. Production and Docker startup abort when it is missing, shorter than 32 characters, or a known placeholder. |
| `PORT` | HTTP listener port. |
| `DATA_DIR` | Stores `orbitpage.db` and uploads. |
| `UPLOAD_STORAGE_QUOTA_MB` | Maximum total upload storage in MB. New uploads are rejected with `413` when exceeded. |
| `VIDEO_UPLOAD_LIMIT_MB` | Per-file limit for uploaded video/background media. Content is also validated by MIME, extension, and binary signature. |
| `FRONTEND_URL` | Optional development CORS/CSP origin. Leave unset for same-origin production. |
| `ORBITPAGE_ALLOWED_ORIGINS` | Optional comma-separated allowlist for trusted cross-origin browser clients. Same-origin deployments should leave it unset. |
| `ORBITPAGE_TRUST_PROXY` | Optional comma-separated trusted proxy IPs/CIDRs or Express named ranges (`loopback`, `linklocal`, `uniquelocal`). Defaults to disabled. Boolean values and hop counts are rejected because they can trust client-supplied forwarding headers. |
| `ORBITPAGE_API_RATE_LIMIT_MAX` | Maximum requests per IP in the general 15-minute API window. Defaults to `300` and is capped at `10000`; sensitive authentication routes keep stricter limits. |
| `DEMO_MODE` | Disables destructive mutations and resets demo data. Not for normal production. |
| `ENABLE_HTTPS` | Enables a self-signed HTTPS listener. Usually unnecessary behind real HTTPS proxies. |
| `SSL_PORT` | HTTPS listener port when `ENABLE_HTTPS=true`. |
| `BASE_PATH` | Optional mount path, for example `/orbitpage`. |
| `PUBLIC_BASE_PATH` | Backward-compatible alias for `BASE_PATH`. |
| `PUBLIC_SITE_URL` | Canonical public URL used for metadata, sitemap, and social previews. |
| `SITE_URL` | Backward-compatible alias for `PUBLIC_SITE_URL`. Prefer `PUBLIC_SITE_URL` in new deployments. |
| `PUBLIC_SITE_NAME` | Site name used in generated metadata. |
| `SEO_INDEXING` | `false`, `0`, `no`, or `off` disables indexing. |
| `RESET_TOKEN` | Optional emergency recovery secret. Leave unset normally; when configured it protects both account recovery and a separate destructive full-reset endpoint. Use a random value of at least 32 characters. |
| `ORBITPAGE_BACKUP_MEDIA_LIMIT_MB` | Maximum total decoded media in a backup export or restore. Defaults to `128`; restored media is restricted to supported image/video signatures. |
| `MEDIA_CLEANUP_ENABLED` | Set to `false` to disable the automatic unused-upload scan. Defaults to enabled outside tests and demo mode. |
| `MEDIA_CLEANUP_GRACE_HOURS` | Minimum age of an unreferenced upload before deletion. Defaults to `24` and accepts values from 1 to 720 hours. |
| `TZ` | Fallback IANA timezone for scheduled content that does not define one. Defaults to `UTC`. |
| `OPENAI_API_KEY` | Optional environment-based OpenAI key for OrbitPage AI. A key saved in the dashboard takes precedence. |
| `OPENAI_PAGE_AGENT_MODEL` | Optional default model. The dashboard defaults to `gpt-5.6-terra` and only accepts its supported model list. |
| `ORBITPAGE_SECRET_ENCRYPTION_KEY` | Optional separate stable secret (32+ characters) for encrypting a dashboard-saved OpenAI key. Falls back to `JWT_SECRET`. |

## RESET_TOKEN lifecycle

`RESET_TOKEN` is an emergency operator secret, not a user password and not a replacement for `JWT_SECRET`. Leave it unset until account recovery is needed. The same secret is accepted by two different endpoints:

- `/api/auth/reset-via-token` changes the fixed `admin` password, removes its TOTP configuration and recovery codes, and revokes that account's existing sessions;
- `/api/auth/force-reset` deletes application data and returns the instance to first-run state.

Use only `reset-via-token` for an administrator lockout. The destructive endpoint is not a password-recovery shortcut. Create a verified backup before enabling the token. The complete request and verification procedure is in [Security](./Security.md#recover-the-admin-account-safely).

### Configure or rotate it on an installer-managed host

The installer stores runtime secrets in `/etc/orbitpage/orbitpage.env`. The following script replaces any prior `RESET_TOKEN` with a new 256-bit value without printing it or placing it in process arguments:

```bash
sudo bash <<'EOF'
set -euo pipefail
env_file=/etc/orbitpage/orbitpage.env
test -f "$env_file"
umask 077
tmp="$(mktemp "${env_file}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
line=''

while IFS= read -r line || test -n "$line"; do
  case "$line" in
    RESET_TOKEN=*) continue ;;
  esac
  printf '%s\n' "$line" >> "$tmp"
done < "$env_file"

printf 'RESET_TOKEN=%s\n' "$(openssl rand -hex 32)" >> "$tmp"
chmod 0600 "$tmp"
chown root:root "$tmp"
mv "$tmp" "$env_file"
trap - EXIT
EOF
```

Recreate the container so it receives the changed environment, then wait for health:

```bash
sudo docker compose \
  --project-name orbitpage \
  --project-directory /opt/orbitpage \
  --file /opt/orbitpage/compose.yaml \
  up -d --force-recreate
sudo orbitpage start
```

`orbitpage restart` and `docker restart` reuse the old container environment; they do not load an edited env file. A recreation or platform redeploy is required.

### Other deployment models

- **Manual Docker or Compose:** keep `RESET_TOKEN` in the same root-owned `0600` env file as the other runtime settings, recreate the container with `--env-file` or Compose `env_file`, and never pass the value with `-e` on the command line.
- **Managed container platform:** create a secret in the platform secret store, map it to `RESET_TOKEN`, and deploy a new revision with exactly one OrbitPage replica.
- **Source/service deployment:** use the service manager's credential or environment-file support. Restrict the file to the service account and restart the service through that manager.

Users with root or Docker-daemon access can inspect container environment variables. Restrict that access even when a protected env file or secret store is used.

### Remove it after recovery

Unless an incident policy requires a continuously available recovery secret, remove it immediately after the new password and TOTP enrollment are verified:

```bash
sudo bash <<'EOF'
set -euo pipefail
env_file=/etc/orbitpage/orbitpage.env
test -f "$env_file"
umask 077
tmp="$(mktemp "${env_file}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
line=''

while IFS= read -r line || test -n "$line"; do
  case "$line" in
    RESET_TOKEN=*) continue ;;
  esac
  printf '%s\n' "$line" >> "$tmp"
done < "$env_file"

chmod 0600 "$tmp"
chown root:root "$tmp"
mv "$tmp" "$env_file"
trap - EXIT
EOF

sudo docker compose \
  --project-name orbitpage \
  --project-directory /opt/orbitpage \
  --file /opt/orbitpage/compose.yaml \
  up -d --force-recreate
sudo orbitpage start
```

Verify that the new container no longer has the variable without displaying any environment values:

```bash
CONTAINER="$(sudo awk -F= '$1 == "ORBITPAGE_CONTAINER_NAME" { print substr($0, index($0, "=") + 1) }' /opt/orbitpage/.env)"
test -n "$CONTAINER"
sudo docker exec "$CONTAINER" node -e 'process.exit(process.env.RESET_TOKEN ? 1 : 0)'
```

Exit status `0` confirms removal. To keep recovery enabled, rotate it with the configuration procedure instead, recreate the container, and invalidate the old secret in the external secret manager or password vault.

## OrbitPage AI

Administrators can configure OrbitPage AI from **Dashboard > AI Assistant** without adding an environment variable. The saved key is encrypted at rest, never returned by the settings API, and excluded from application backups. Keep `JWT_SECRET` stable across restarts, or set a separate stable `ORBITPAGE_SECRET_ENCRYPTION_KEY`.

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

Store these values in a protected environment file or the platform secret store. The `JWT_SECRET` line below is a placeholder, not a value to pass on a command line or commit.

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
- `/dashboard/<section>` and `/orbitpage/dashboard/<section>` (for example `profile`, `content`, or `theme`)
- `/admin` and `/orbitpage/admin` remain compatibility aliases
- `/api/...` and `/orbitpage/api/...`
- `/uploads/...` and `/orbitpage/uploads/...`
