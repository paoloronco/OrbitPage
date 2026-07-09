# SEO and Indexing

Lynx generates search and sharing metadata from the saved profile plus environment variables. Most deployments do not need source-code edits for SEO.

## Recommended Production Settings

```bash
PUBLIC_SITE_URL=https://links.example.com
PUBLIC_SITE_NAME="Your Name or Brand"
SEO_INDEXING=true
```

Then use the admin panel to configure:

- profile name
- bio
- page title
- meta description
- avatar
- social links
- legal policy URLs

## What Lynx Generates

- HTML title
- meta description
- canonical URL
- robots meta tag
- Open Graph metadata
- Twitter Card metadata
- Schema.org JSON-LD
- dynamic `/robots.txt`
- dynamic `/sitemap.xml` with `lastmod` based on public content changes
- no-JavaScript fallback links for crawlers

## Staging and Private Deployments

Disable indexing without changing source code:

```bash
SEO_INDEXING=false
```

This makes Lynx:

- emit `noindex, nofollow, noarchive`
- serve a restrictive `robots.txt`
- avoid exposing staging/private pages to search engines

## Canonical URLs

Set `PUBLIC_SITE_URL` when Lynx is behind:

- a reverse proxy
- a tunnel
- a CDN
- a managed platform that sends internal host headers

Without `PUBLIC_SITE_URL`, Lynx derives canonical URLs from the incoming request host and protocol.

## Sitemap

Lynx includes:

- the public home page
- local legal pages when `/privacy` or `/cookies` are configured as profile policy URLs

The sitemap is generated on each request and uses the latest public-content timestamp from profile data, links, theme settings, consent settings, and editable TXT files. This keeps `lastmod` useful for crawlers without requiring a manual rebuild.

Private routes such as admin, API, health, and unknown SPA routes are excluded and marked `noindex`.

## Contributor Checklist

- Public routes should have one canonical URL.
- Admin, API, health, and private routes must stay `noindex`.
- New public pages should enter the sitemap only when they contain durable public content.
- Public links should remain real anchors when possible.
- Do not block `/assets`, CSS, JavaScript, or public uploaded images in `robots.txt`.
- Keep metadata configurable through profile data or environment variables.
