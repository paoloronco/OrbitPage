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
- optional Markdown content negotiation for public pages
- optional generated `/llms.txt` and `/llm.txt`
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

Open **Admin > Publish > Sitemap** and select **Generate sitemap** to create the sitemap state and expose its public URL. The XML is derived from current public data on request, so hostname changes and later page publications stay aligned without accepting raw XML from the browser. Use **Regenerate sitemap** when you want to record a new explicit generation time.

The section shows the public URL, included URL count, generation date, copy/open controls and current publication status. Sitemap state is included in the **Discovery files** backup section.

Private routes such as admin, API, health, and unknown SPA routes are excluded and marked `noindex`.

## TXT Files

The **Admin > Publish > TXT** tool can edit `robots.txt`, `llms.txt`, `humans.txt`, `security.txt`, and `ai.txt`. The plural `llms.txt` is canonical; `/llm.txt` serves the same content as a compatibility alias.

Enable **Machine-readable access** in **Profile > Online presence** to publish both the generated `llms.txt` and the Markdown representation of each public page. With the option enabled, `Accept: text/markdown` returns the current public content from the same URL; HTML remains the default and responses include `Vary: Accept`. Disabling the option returns `406` for Markdown negotiation and `404` for the AI discovery files. JSON-LD remains in HTML because it is standard search metadata.

Machine-readable requests use only local application data and do not call an AI provider. The server stores daily aggregate counts by format and public path in SQLite without IP addresses, user agents, referrers, cookies, or page content. Administrators with `analytics:read` can retrieve the last 30 days from `/api/analytics/machine-readable`.

You can also add up to 20 custom endpoints using `/name.txt` or `/.well-known/name.txt`. OrbitPage normalizes paths to lowercase, prevents reserved-name collisions and path traversal, and serves every file with browser sniffing disabled. `llms.txt` uses `text/markdown`; other TXT files use `text/plain`. TXT files and custom paths are included in the **Discovery files** backup section.

## Contributor Checklist

- Public routes should have one canonical URL.
- Admin, API, health, and private routes must stay `noindex`.
- New public pages should enter the sitemap only when they contain durable public content.
- Public links should remain real anchors when possible.
- Do not block `/assets`, CSS, JavaScript, or public uploaded images in `robots.txt`.
- Keep metadata configurable through page data or environment variables.
