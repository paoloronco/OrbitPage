# Security

This guide explains the implemented protections and installation settings. Report vulnerabilities using [SECURITY.md](../../SECURITY.md).

## Accounts and sessions

- Passwords use bcrypt with 12 salt rounds. Sessions use signed JWTs with a 12-hour expiry.
- The first account is `admin`; additional users receive server-enforced roles.
- Password and TOTP changes revoke older sessions. Deleting or restoring accounts invalidates their prior credentials; account restore also revokes personal API tokens.
- Personal API tokens are stored as hashes, restricted by the account's role, and cannot manage users, change passwords, or create browser sessions.

Browser sessions use encrypted, session-scoped `sessionStorage` when Web Crypto is available. On insecure HTTP without Web Crypto, credentials stay in memory for the current document. Old persistent token entries are removed. Use HTTPS for remote access.

## Two-factor authentication

Enable TOTP under **Account → Security**. Enrollment and later changes require the current password; recovery-code replacement and disabling TOTP also require an authenticator or recovery code.

TOTP secrets are encrypted with AES-256-GCM using a key derived from `JWT_SECRET`. Enrollment displays ten single-use recovery codes once; only salted scrypt hashes are stored. The sign-in challenge expires after five minutes and cannot access application APIs.

Keep the instance secret and recovery codes private and backed up. See [Account and team](./dashboard/sections/account-and-team.md) for normal changes, or [Administrator recovery](./recovery.md) after a lockout.

## API and public content

| Area | Protection |
| --- | --- |
| Inputs | Server schemas, permission checks, and parameterized SQLite queries |
| Requests | Rate limits for API, authentication, reset, and page routes |
| Cross-origin access | Same-origin by default; additional origins must be configured |
| Forwarded headers | Accepted only from proxies configured in `ORBITPAGE_TRUST_PROXY` |
| Public responses | Hide unpublished content, account data, secrets, and editing/scheduling metadata |
| Uploads and restores | Validate paths, size, media type, and binary signatures |
| Instance reset | Administrator permission plus current-password verification |

Adding or activating arbitrary embed code, executable consent/policy snippets, or third-party embeds marked Necessary requires administrator permission. Cosmetic edits to approved embeds remain available to the relevant editors.

Privacy code restored from a backup or local version stays blocked until an administrator reviews and saves Privacy. Imports, subpages, and AI operations use the same authorization checks.

Uploads under `DATA_DIR/uploads` are public media. Do not place private documents there. Restore stages media and rolls back the replacement with the database transaction if it fails.

## Installation settings

- Complete administrator setup before exposing the instance; optional `REQUIRE_SETUP_TOKEN` proves host access during setup.
- Use HTTPS and restrict server and Docker access to trusted operators.
- Persist and back up `DATA_DIR` and the stable instance secret.
- Leave `RESET_TOKEN` unset outside recovery.
- Set proxy trust only to the actual proxy addresses or ranges.
- Keep the image and host packages updated.
- Keep databases, sidecars, uploads, secrets, logs, and environment files out of source control and container images.
- Use separate disposable data for demo mode. `SEO_INDEXING=false` prevents indexing; it does not restrict access.

See [Deployment](./Deployment.md), [Configuration](./Configuration.md), and [Maintenance](./maintenance.md) for commands.
