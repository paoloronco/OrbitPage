# Security

This page summarizes how OrbitPage handles security-sensitive behavior. For vulnerability reporting, see the repository `SECURITY.md`.

## Authentication

- Admin users authenticate with username and password.
- Passwords are hashed with `bcryptjs` using 12 salt rounds.
- Sessions use signed JWTs with a 12-hour expiry.
- The first username is `admin`.
- Additional users can be managed from the admin access area.

## Browser Token Storage

In secure browser contexts, OrbitPage stores the JWT encrypted with AES-GCM in `localStorage`.

When Web Crypto is unavailable on non-secure HTTP contexts, OrbitPage falls back to `sessionStorage`, which is cleared when the tab/session ends.

## Backend Protections

- SQLite queries use parameterized helpers.
- Auth, reset, API, and SPA routes are rate-limited.
- API routes validate input with server-side logic and schemas where applicable.
- Docker requires `JWT_SECRET` before startup.
- Optional `RESET_TOKEN` protects recovery endpoints.

### Two-factor authentication

Each self-hosted administrator can enable time-based one-time passwords under **Dashboard > Access**. OrbitPage uses the standard TOTP format supported by Google Authenticator, Microsoft Authenticator, 1Password and compatible password managers.

- The password is always verified before setup, recovery-code rotation or disabling 2FA.
- The TOTP secret is encrypted at rest with AES-256-GCM using a key derived from the stable `JWT_SECRET`.
- Ten single-use recovery codes are generated at enrollment and displayed once. Only salted scrypt hashes are stored.
- A successful recovery-code login consumes that code atomically.
- Disabling 2FA, changing a password or using the operator reset increments the account authentication version and invalidates older sessions.
- The short-lived pre-authentication challenge cannot access application APIs and expires after five minutes.

Keep `JWT_SECRET` stable and backed up. Losing it makes encrypted TOTP secrets unreadable. If both the authenticator and recovery codes are lost, the instance owner can use the existing `RESET_TOKEN` recovery flow; this resets the password, removes 2FA and revokes active sessions.

## Deployment Hardening

Recommended production practices:

- run behind HTTPS
- set a long random `JWT_SECRET`
- keep `JWT_SECRET` stable across restarts
- persist and back up `DATA_DIR`
- restrict admin access to trusted users
- keep the Docker image and host packages updated
- set `SEO_INDEXING=false` for staging/private instances
- do not use public demo credentials in production

## File Uploads

Uploads are stored in `DATA_DIR/uploads` and served from `/uploads`.

Only expose upload storage that is intended to be public on the public page. Do not place private files in the upload directory.

## Security Reporting

Report suspected vulnerabilities privately:

- GitHub Security Advisory: <https://github.com/paoloronco/OrbitPage/security/advisories/new>
- Email: `info@paoloronco.it`

Do not open public issues for unpatched vulnerabilities.
