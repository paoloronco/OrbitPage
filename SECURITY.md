# Security Policy

Security reports are welcome and should be handled privately until a fix is available.

## Reporting a Vulnerability

Please do not open a public issue for an unpatched vulnerability.

Preferred reporting channels:

- GitHub Security Advisory: <https://github.com/paoloronco/Lynx/security/advisories/new>
- Email: `info@paoloronco.it`

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
- Dependency vulnerabilities with a realistic exploit path in Lynx
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
- Admin sessions use signed JWTs with a 12-hour expiry.
- In secure browser contexts, the frontend stores the JWT encrypted with AES-GCM in `localStorage`.
- On non-secure HTTP contexts where Web Crypto is unavailable, the frontend falls back to `sessionStorage`.
- SQLite queries use parameterized statements through server-side helpers.
- Auth, reset, API, and SPA routes are rate-limited.
- Docker startup requires `JWT_SECRET`; production Node deployments should also set it explicitly.
- Optional `RESET_TOKEN` enables protected recovery endpoints and should be at least 32 characters.
- Uploaded files are written under `DATA_DIR/uploads` and served from `/uploads`.

## Deployment Recommendations

- Run behind HTTPS in production.
- Set a long random `JWT_SECRET` and keep it stable across restarts.
- Persist and back up `DATA_DIR`; it contains the SQLite database and uploads.
- Keep Docker images, Node.js, npm dependencies, and host packages updated.
- Limit admin access to trusted users.
- Disable indexing on staging/private deployments with `SEO_INDEXING=false`.
- Do not reuse the public demo password on a real deployment.

## Disclosure

Please keep vulnerability details private until a fix, mitigation, or maintainer-approved disclosure is available.

Safe harbor applies for good-faith research that follows this policy, avoids privacy violations, avoids service disruption, and does not access or modify data beyond what is needed to prove the issue.

## Bug Bounty

There is no paid bug bounty program at this time. Researchers may be credited in release notes when appropriate.
