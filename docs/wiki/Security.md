# Security

This page summarizes how Lynx handles security-sensitive behavior. For vulnerability reporting, see the repository `SECURITY.md`.

## Authentication

- Admin users authenticate with username and password.
- Passwords are hashed with `bcryptjs` using 12 salt rounds.
- Sessions use signed JWTs with a 12-hour expiry.
- The first username is `admin`.
- Additional users can be managed from the admin access area.

## Browser Token Storage

In secure browser contexts, Lynx stores the JWT encrypted with AES-GCM in `localStorage`.

When Web Crypto is unavailable on non-secure HTTP contexts, Lynx falls back to `sessionStorage`, which is cleared when the tab/session ends.

## Backend Protections

- SQLite queries use parameterized helpers.
- Auth, reset, API, and SPA routes are rate-limited.
- API routes validate input with server-side logic and schemas where applicable.
- Docker requires `JWT_SECRET` before startup.
- Optional `RESET_TOKEN` protects recovery endpoints.

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

Only expose upload storage that is intended to be public on the profile page. Do not place private files in the upload directory.

## Security Reporting

Report suspected vulnerabilities privately:

- GitHub Security Advisory: <https://github.com/paoloronco/Lynx/security/advisories/new>
- Email: `info@paoloronco.it`

Do not open public issues for unpatched vulnerabilities.
