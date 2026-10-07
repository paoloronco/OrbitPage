# Administrator recovery

Use this procedure when the first `admin` account has lost its password, authenticator, and recovery codes. For a user's normal password or TOTP change, use [Account and team](./account-and-team.md).

## Reset operations

`RESET_TOKEN` authorizes two operations with very different impact:

| Endpoint | Intended use | Effect |
| --- | --- | --- |
| `POST /api/auth/reset-via-token` | Recover the fixed `admin` account | Changes its password, removes TOTP and recovery codes, and increments its authentication version so older `admin` sessions are rejected |
| `POST /api/auth/force-reset` | Destructive instance reset | Deletes application data and returns OrbitPage to first-run state |

Use `reset-via-token` for account recovery. `force-reset` deletes instance data. Create and verify an infrastructure backup before enabling `RESET_TOKEN`; see [Maintenance](./maintenance.md#create-and-verify-an-infrastructure-backup).

The shared reset limiter permits only two attempts per hour per source IP. Generate a strong token, use the exact request once, and do not test guessed values repeatedly.

## Configure or rotate it on an installer-managed host

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

## Other deployment models

- **Manual Docker or Compose:** keep `RESET_TOKEN` in the same root-owned `0600` env file as the other runtime settings, recreate the container with `--env-file` or Compose `env_file`, and never pass the value with `-e` on the command line.
- **Managed container platform:** create a secret in the platform secret store, map it to `RESET_TOKEN`, and deploy a new revision with exactly one OrbitPage replica.
- **Source/service deployment:** use the service manager's credential or environment-file support. Restrict the file to the service account and restart the service through that manager.

Users with root or Docker-daemon access can inspect container environment variables. Restrict that access even when a protected env file or secret store is used.

## Recover the admin account safely

1. Use a trusted root console on the OrbitPage host or guest. Avoid a shared shell, terminal recording, debug tracing, and public HTTP.
2. [Configure or rotate `RESET_TOKEN`](#configure-or-rotate-it-on-an-installer-managed-host), recreate the container, and confirm `/health` is successful.
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

5. [Remove or rotate `RESET_TOKEN`](#remove-it-after-recovery), recreate the container, and verify that the old recovery window is closed.

Do not rotate `JWT_SECRET` as part of this procedure. Changing `JWT_SECRET` invalidates all signed sessions and can make encrypted TOTP or dashboard-saved provider secrets unreadable.

## Remove it after recovery

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
