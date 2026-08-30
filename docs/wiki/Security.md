# Security

This page summarizes how OrbitPage handles security-sensitive behavior. For vulnerability reporting, see the repository [Security Policy](../../SECURITY.md).

## Authentication

- Admin users authenticate with username and password.
- Passwords are hashed with `bcryptjs` using 12 salt rounds.
- Sessions use signed JWTs with a 12-hour expiry.
- The first username is `admin`.
- Additional users can be managed from **Dashboard > Team**.

## Browser Token Storage

In secure browser contexts, OrbitPage stores the JWT encrypted with AES-GCM in session-scoped `sessionStorage`. Persistent legacy token entries are ignored and removed.

When Web Crypto is unavailable on non-secure HTTP contexts, OrbitPage keeps the JWT in memory for the current document instead of writing a plaintext fallback. Use HTTPS in production.

## Backend Protections

- SQLite queries use parameterized helpers.
- Auth, reset, API, and SPA routes are rate-limited.
- API routes validate input with server-side logic and schemas where applicable.
- Every production runtime requires a stable `JWT_SECRET` of at least 32 characters and rejects known placeholders.
- Optional `RESET_TOKEN` protects an administrator-recovery endpoint and a separate destructive full-reset endpoint. Leave it unset outside a controlled recovery window.
- Destructive in-dashboard instance reset requires `users:manage` and re-authentication with the current password.
- Forwarded client/protocol headers are ignored unless the socket peer is explicitly trusted with `ORBITPAGE_TRUST_PROXY`.
- Public content APIs return only enabled content and omit editing, scheduling, campaign, and analytics metadata.

Privacy editors can configure consent categories, legal text, and structured identifiers for supported CMP providers. Adding or activating raw CMP snippets or embedded policy code requires the administrator-level `users:manage` permission because that content executes in the public page origin.

### Two-factor authentication

Each self-hosted administrator can enable time-based one-time passwords under **Dashboard > Account**. OrbitPage uses the standard TOTP format supported by Google Authenticator, Microsoft Authenticator, 1Password and compatible password managers.

- The password is always verified before setup, recovery-code rotation or disabling 2FA.
- The TOTP secret is encrypted at rest with AES-256-GCM using a key derived from the stable `JWT_SECRET`.
- Browser admin credentials are retained only for the current browser session. The encrypted JWT is stored in `sessionStorage`, not persistent `localStorage`, and is removed on logout.
- Cross-origin browser access is denied by default. Use `ORBITPAGE_ALLOWED_ORIGINS` only for explicitly trusted separate frontends.
- Ten single-use recovery codes are generated at enrollment and displayed once. Only salted scrypt hashes are stored.
- A successful recovery-code login consumes that code atomically.
- Disabling 2FA, changing a password or using the operator reset increments the account authentication version and invalidates older sessions.
- The short-lived pre-authentication challenge cannot access application APIs and expires after five minutes.

Keep `JWT_SECRET` stable and backed up. Losing it makes encrypted TOTP secrets unreadable. If both the authenticator and recovery codes are lost, the instance owner can enable the controlled `RESET_TOKEN` recovery flow; this resets the `admin` password, removes its 2FA configuration, and revokes its active sessions.

## Emergency administrator recovery

### Know which reset operation you are using

`RESET_TOKEN` authorizes two operations with very different impact:

| Endpoint | Intended use | Effect |
| --- | --- | --- |
| `POST /api/auth/reset-via-token` | Recover the fixed `admin` account | Changes its password, removes TOTP and recovery codes, and increments its authentication version so older `admin` sessions are rejected |
| `POST /api/auth/force-reset` | Destructive instance reset | Deletes application data and returns OrbitPage to first-run state |

Never use `force-reset` for a lost password or authenticator. It is not a stronger account reset. Create and verify an infrastructure backup before enabling `RESET_TOKEN`; see [Deployment](./Deployment.md#create-and-verify-an-infrastructure-backup).

The shared reset limiter permits only two attempts per hour per source IP. Generate a strong token, use the exact request once, and do not test guessed values repeatedly.

### Recover the admin account safely

1. Use a trusted root console on the OrbitPage host or guest. Avoid a shared shell, terminal recording, debug tracing, and public HTTP.
2. [Configure or rotate `RESET_TOKEN`](./Configuration.md#configure-or-rotate-it-on-an-installer-managed-host), recreate the container, and confirm `/health` is successful.
3. Run the following from an installer-managed host. It reads the recovery secret from the protected env file, prompts for the password through the terminal, and sends both values to the container over standard input. Neither value is placed in command arguments or printed.

   The new password must contain at least eight characters, including uppercase, lowercase, a number, and a special character.

   ```bash
   sudo bash <<'EOF'
   set -euo pipefail
   RESET_TOKEN="$(awk -F= '$1 == "RESET_TOKEN" { print substr($0, index($0, "=") + 1); exit }' /etc/orbitpage/orbitpage.env)"
   ORBITPAGE_CONTAINER_NAME="$(awk -F= '$1 == "ORBITPAGE_CONTAINER_NAME" { print substr($0, index($0, "=") + 1); exit }' /opt/orbitpage/.env)"
   : "${RESET_TOKEN:?RESET_TOKEN is not configured}"
   : "${ORBITPAGE_CONTAINER_NAME:?OrbitPage container name is unavailable}"
   trap 'unset RESET_TOKEN new_password confirm_password' EXIT

   IFS= read -r -s -p 'New admin password: ' new_password </dev/tty
   printf '\n' >/dev/tty
   IFS= read -r -s -p 'Confirm new admin password: ' confirm_password </dev/tty
   printf '\n' >/dev/tty
   test "$new_password" = "$confirm_password" || {
     printf 'Passwords do not match.\n' >&2
     exit 1
   }

   printf '%s\000%s' "$RESET_TOKEN" "$new_password" |
     docker exec -i "$ORBITPAGE_CONTAINER_NAME" node -e '
   const chunks = [];
   process.stdin.on("data", (chunk) => chunks.push(chunk));
   process.stdin.on("end", async () => {
     try {
       const input = Buffer.concat(chunks).toString("utf8");
       const separator = input.indexOf("\0");
       if (separator < 0) throw new Error("Recovery input was incomplete.");
       const token = input.slice(0, separator);
       const newPassword = input.slice(separator + 1);
       const port = process.env.PORT || "8080";
       const response = await fetch(`http://127.0.0.1:${port}/api/auth/reset-via-token`, {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({ token, newPassword }),
       });
       const responseBody = await response.text();
       console.log(responseBody);
       if (!response.ok) process.exitCode = 1;
     } catch (error) {
       console.error(error instanceof Error ? error.message : "Recovery request failed.");
       process.exitCode = 1;
     }
   });'

   EOF
   ```

   The loopback request remains valid when a public `BASE_PATH` is configured. For a manually named container, use that name and read the secret from its protected env file; do not copy the value into a `curl` argument or shell history.

4. Require all of these checks before closing the recovery:

   - the response reports a successful password and two-factor reset;
   - an already-open browser session for `admin` is rejected after refresh or its next protected API request;
   - the new password can log in without an old TOTP challenge;
   - a different user account, if configured, is unaffected;
   - TOTP is enrolled again and the new single-use recovery codes are stored securely.

   The session-revocation check matters: `reset-via-token` invalidates existing sessions for `admin`, not every additional dashboard user.

5. [Remove or rotate `RESET_TOKEN`](./Configuration.md#remove-it-after-recovery), recreate the container, and verify that the old recovery window is closed.

Do not rotate `JWT_SECRET` as part of this procedure. Changing `JWT_SECRET` invalidates all signed sessions and can make encrypted TOTP or dashboard-saved provider secrets unreadable.

## Deployment Hardening

Recommended production practices:

- run behind HTTPS
- set a long random `JWT_SECRET`
- keep `JWT_SECRET` stable across restarts
- leave `RESET_TOKEN` unset outside a controlled recovery window
- persist and back up `DATA_DIR`
- keep `ORBITPAGE_TRUST_PROXY` unset unless OrbitPage is directly behind a known proxy; then list only that proxy's IP/CIDR
- restrict admin access to trusted users
- keep the Docker image and host packages updated
- keep databases, database backups and sidecars, uploads, logs, and environment files out of source control and container images
- set `SEO_INDEXING=false` for staging/private instances
- do not use public demo credentials in production

## File Uploads

Uploads are stored in `DATA_DIR/uploads` and served from `/uploads`.

Only expose upload storage that is intended to be public on the public page. Do not place private files in the upload directory.

Application backup restore validates paths, strict base64, supported extensions and binary media signatures before changing live uploads. The replacement is staged and rolled back together with the database transaction if restoration fails. Keep `ORBITPAGE_BACKUP_MEDIA_LIMIT_MB` conservative for the host's available memory.

## Security Reporting

Report suspected vulnerabilities privately:

- GitHub Security Advisory: <https://github.com/paoloronco/OrbitPage/security/advisories/new>
- Email: `contact@orbitpage.com`

Do not open public issues for unpatched vulnerabilities.
