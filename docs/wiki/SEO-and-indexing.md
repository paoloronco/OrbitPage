# SEO and indexing

OrbitPage generates search and sharing metadata from saved page data. Configure it in **Page** and **Publish**.

## Set the public URL

Set these runtime values through [Configuration](./Configuration.md):

```dotenv
PUBLIC_SITE_URL=https://page.example.com
PUBLIC_SITE_NAME=My page
SEO_INDEXING=true
```

Include any mount path in `PUBLIC_SITE_URL`. Without it, the server derives the URL from the request host and protocol; proxies may supply an internal address.

In **Page**, set the page name, browser title, description, profile image, and social links.

## Generated metadata

| Output | Source |
| --- | --- |
| HTML title and description | Saved page/profile fields |
| Canonical URL | Public URL and active public path |
| Open Graph and Twitter cards | Page metadata and image |
| Schema.org JSON-LD | Saved public profile/content |
| Robots meta | Indexing setting and route |
| No-JavaScript links | Public content for crawlers |
| Sitemap | Enabled public destinations and content-change dates |

Dashboard, API, health, and unknown routes are excluded from indexing.

For staging or a private instance, set `SEO_INDEXING=false`. It emits `noindex, nofollow, noarchive` and restrictive robots rules. This requests that crawlers stay away; it does not protect a page from visitors.

## Sitemap

Open **Publish → Sitemap** and select **Generate sitemap**. The XML at `/sitemap.xml` follows current saved data; regenerate to record a new generation time.

It includes the main page, published additional pages, the enabled menu, and local policy pages when configured. Demo mode also includes About.

The workspace shows the URL, route count, generation time, and copy/open controls. Sitemap settings are included in **Discovery files** exports.

## Text files and machine-readable pages

**Publish → TXT** edits:

- `robots.txt`;
- `llms.txt` (with `/llm.txt` as an alias);
- `humans.txt`, `security.txt`, and `ai.txt`;
- up to 20 custom `/name.txt` or `/.well-known/name.txt` paths.

Custom paths are normalized to lowercase and cannot collide with reserved names or traverse directories. Text files are included in **Discovery files** exports.

Enable **Machine-readable access** under **Page → Online presence** to expose generated LLM discovery and Markdown page representations:

| Request | Enabled | Disabled |
| --- | --- | --- |
| Public URL with `Accept: text/markdown` | Saved public content as Markdown, with `Vary: Accept` | `406` |
| Generated AI discovery files | Served | `404` |
| Normal public URL | HTML with JSON-LD | HTML with JSON-LD |

These responses use local data and do not call an AI provider. SQLite stores daily counts by format and public path, without IP, user-agent, referrer, cookie, or page-content data. `GET /api/analytics/machine-readable` returns the latest 30 days to users with `analytics:read`.

Keep public links as real anchors and avoid blocking assets or public media in robots rules. See [Publishing](./publishing.md) for sharing tools.
