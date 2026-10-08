# Security Policy

Security reports are welcome and should be handled privately until a fix is available.

## Reporting a Vulnerability

Please do not open a public issue for an unpatched vulnerability.

Preferred reporting channels:

- GitHub Security Advisory: <https://github.com/paoloronco/OrbitPage/security/advisories/new>
- Email: `contact@orbitpage.com`

Include as much of this information as possible:

- affected version, commit, or Docker image tag
- deployment method and environment details
- clear impact description
- reproduction steps, proof of concept, payloads, or HTTP requests
- required account role or authentication state
- known workaround, if any

## Response Targets

| Step | Target |
| --- | --- |
| Acknowledgement | within 72 hours |
| Initial triage | within 7 days |
| Fix or mitigation plan | within 30 days for confirmed high/critical issues |
| Public disclosure | after a release or documented mitigation is available |

These are targets, not contractual guarantees.

## Supported Versions

| Version | Security status |
| --- | --- |
| Latest `4.x` release | Supported |
| Older `4.x` releases | Best effort; update to latest before reporting when possible |
| `3.x` and earlier | Not supported |

## In Scope

- Authentication or session handling flaws
- Authorization bypass or privilege escalation
- SQL injection, command injection, path traversal, LFI/RFI, or RCE
- Stored or reflected XSS with practical impact
- File upload issues that lead to unauthorized access or execution
- Sensitive data exposure
- Dependency vulnerabilities with a realistic exploit path in OrbitPage
- Docker or deployment defaults that create unsafe production behavior

## Out of Scope

- Denial-of-service reports without demonstrated practical impact
- Automated scanner output without reproduction steps
- Theoretical issues that do not cross a trust boundary
- Vulnerabilities in browsers, hosting providers, or third-party services
- Social engineering or physical attacks
- Public demo content changes made through published demo credentials

## Current Security Model

- Passwords are hashed with `bcryptjs` using 12 salt rounds.
- Admin sessions use purpose-isolated signed JWTs with a 12-hour expiry.
- Dashboard logout rotates the account's server session identity, revoking all existing dashboard tokens for that account. Personal API tokens keep their separate revocation lifecycle.
- In secure browser contexts, the frontend stores the JWT encrypted with AES-GCM in session-scoped `sessionStorage` and removes legacy persistent copies.
- On non-secure HTTP contexts where Web Crypto is unavailable, the frontend keeps the JWT in memory for the current document instead of writing a plaintext fallback.
- SQLite queries use parameterized statements through server-side helpers.
- Auth, reset, API, and SPA routes are rate-limited.
- The Content Security Policy permits `blob:` URLs only for local image and media previews; scripts and workers remain restricted.
- Docker generates `JWT_SECRET` once under persistent `DATA_DIR`; production Node deployments must set it explicitly.
- Initial administrator setup is claimed by the first person to complete the browser wizard. Operators can require the owner-only `DATA_DIR/.setup-token` with `REQUIRE_SETUP_TOKEN=true`; full reset rotates the token when enabled.
- Optional `RESET_TOKEN` enables protected recovery endpoints and should be at least 32 characters.
- Uploaded files are written under `DATA_DIR/uploads` and served from `/uploads`.
- AI screenshot input accepts only supported image MIME types with matching file signatures.
- The web updater accepts bounded stable version identifiers before starting an update job.

## Deployment Recommendations

Shop admin APIs require `users:manage`; demo mode blocks commerce mutations.
Digital files live outside public uploads and require verified payments and
expiring, bounded delivery capabilities. Raw Stripe and Cal.com webhooks verify
signatures before changing orders. Original subtotal, Stripe discounts, captured
funds, session/metadata/account/mode and payment bindings are checked server-side.
Owner Stripe and Shop SMTP credentials are encrypted with a stable server key;
changing the account or mode is blocked once orders exist. Dashboard Shop backups
contain customer data, encrypted settings and private files and must be protected.
See [Shop operations](./docs/wiki/dashboard/sections/shop.md).

- Linux and Proxmox installers default to `0.0.0.0:8080` for LAN access. Set `ORBITPAGE_BIND_ADDRESS=127.0.0.1` for local-only access; use HTTPS for public access. See [Deployment](./docs/wiki/administration/Deployment.md#lan-and-loopback).
- Persist and back up `DATA_DIR`; it contains the generated `JWT_SECRET`, SQLite database, and uploads. Keep any explicit secret override stable across restarts.
- Never bake databases, database backups or sidecars, uploads, logs, or environment files into an image or source archive.
- Keep Docker images, Node.js, npm dependencies, and host packages updated.
- For deployments that require release integrity, install from a reviewed local source checkout and pin an independently reviewed OCI image digest. The optional `:latest` update path still follows a mutable registry tag and does not verify a signed release attestation.
- Limit admin access to trusted users.
- Disable indexing on staging/private deployments with `SEO_INDEXING=false`.
- Do not reuse the public demo password on a real deployment.

## Disclosure

Please keep vulnerability details private until a fix, mitigation, or maintainer-approved disclosure is available.

Safe harbor applies for good-faith research that follows this policy, avoids privacy violations, avoids service disruption, and does not access or modify data beyond what is needed to prove the issue.

## Bug Bounty

There is no paid bug bounty program at this time. Researchers may be credited in release notes when appropriate.
