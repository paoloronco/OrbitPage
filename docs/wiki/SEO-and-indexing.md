# SEO and Indexing

OrbitPage generates search and sharing metadata from the saved public page plus environment variables. Most deployments do not need source-code edits for SEO.

## Recommended Production Settings

```bash
PUBLIC_SITE_URL=https://links.example.com
PUBLIC_SITE_NAME="Your Name or Brand"
SEO_INDEXING=true
```

Then use the admin panel to configure:

- page name
- description
- page title
- meta description
- avatar
- social links
- legal policy URLs

## What OrbitPage Generates

- HTML title
- meta description
- canonical URL
- robots meta tag
- Open Graph metadata
- Twitter Card metadata
- Schema.org JSON-LD
- dynamic `/robots.txt`
- generated `/sitemap.xml` with `lastmod` based on public content changes
- no-JavaScript fallback links for crawlers

## Staging and Private Deployments

Disable indexing without changing source code:

```bash
SEO_INDEXING=false
```

This makes OrbitPage:

- emit `noindex, nofollow, noarchive`
- serve a restrictive `robots.txt`
- avoid exposing staging/private pages to search engines

## Canonical URLs

Set `PUBLIC_SITE_URL` when OrbitPage is behind:

- a reverse proxy
- a tunnel
- a CDN
- a managed platform that sends internal host headers

Without `PUBLIC_SITE_URL`, OrbitPage derives canonical URLs from the incoming request host and protocol.

## Sitemap

OrbitPage includes:

- the public home page
- local legal pages when `/privacy` or `/cookies` are configured as profile policy URLs

Open **Admin > Sitemap** and select **Generate sitemap** to create the sitemap state and expose its public URL. The XML is derived from current public data on request, so hostname changes and later page publications stay aligned without accepting raw XML from the browser. Use **Regenerate sitemap** when you want to record a new explicit generation time.

The section shows the public URL, included URL count, generation date, copy/open controls and current publication status. Sitemap state is included in the **Discovery files** backup section.

Private routes such as admin, API, health, and unknown SPA routes are excluded and marked `noindex`.

## TXT Files

The Admin **TXT** section can edit `robots.txt`, `llms.txt`, `humans.txt`, `security.txt`, and `ai.txt`. The plural `llms.txt` is canonical; `/llm.txt` serves the same content as a compatibility alias.

You can also add up to 20 custom endpoints using `/name.txt` or `/.well-known/name.txt`. OrbitPage normalizes paths to lowercase, prevents reserved-name collisions and path traversal, and serves every file as `text/plain` with browser sniffing disabled. TXT files and custom paths are included in the **Discovery files** backup section.

## Contributor Checklist

- Public routes should have one canonical URL.
- Admin, API, health, and private routes must stay `noindex`.
- New public pages should enter the sitemap only when they contain durable public content.
- Public links should remain real anchors when possible.
- Do not block `/assets`, CSS, JavaScript, or public uploaded images in `robots.txt`.
- Keep metadata configurable through page data or environment variables.
