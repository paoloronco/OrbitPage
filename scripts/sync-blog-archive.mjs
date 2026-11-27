import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://orbitpage.com';
const LANGUAGES = { en: 'English', it: 'Italiano', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', nl: 'Nederlands', pl: 'Polski', tr: 'Türkçe', ru: 'Русский', ar: 'العربية', zh: '中文', ja: '日本語', ko: '한국어' };
const MAX_BYTES = 2_000_000;
const hash = text => createHash('sha256').update(text).digest('hex');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const label = text => text.replace(/[\\[\]|<>`*]/g, character => `&#${character.charCodeAt(0)};`).replace(/[\r\n]+/g, ' ');

function validateArticles(articles, state = false) {
  if (!Array.isArray(articles) || articles.length > 10_000) throw new Error('Invalid article manifest');
  const keys = new Set();
  for (const article of articles) {
    if (!article || typeof article.slug !== 'string' || article.slug.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)
      || /^(?:readme|con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(article.slug)
      || !Object.hasOwn(LANGUAGES, article.locale) || typeof article.title !== 'string' || article.title.length > 1000
      || typeof article.published !== 'string' || !/^(?:\d{4}-\d{2}-\d{2})?$/.test(article.published)
      || !hex(article.revision) || (state && !hex(article.sha256))) throw new Error('Unsafe article manifest entry');
    const key = `${article.locale}/${article.slug}`;
    if (keys.has(key)) throw new Error('Duplicate article manifest entry');
    keys.add(key);
  }
  return articles;
}

async function readPublic(url, fetcher, expectedType) {
  // Remote data never supplies a URL, host, destination path or executable command.
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Accept: expectedType } });
  if (!response.ok || !response.headers.get('content-type')?.startsWith(expectedType)) throw new Error(`Public export failed: ${response.status}`);
  if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('Export too large');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Export too large');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return { text: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), response };
}

async function fileOrNull(path) {
  try { return await readFile(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function rejectSymlinks(root, relative) {
  let current = root;
  for (const part of relative.split('/')) {
    current = join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error('Archive cannot contain symbolic links'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export async function syncBlogArchive({ root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), fetcher = fetch, maxDownloads = 128 } = {}) {
  root = resolve(root);
  await rejectSymlinks(root, 'docs/blog');
  await rejectSymlinks(root, 'docs/blog/manifest.json');
  const archive = join(root, 'docs', 'blog');
  const existing = await fileOrNull(join(archive, 'manifest.json'));
  const old = existing ? JSON.parse(existing) : { version: 1, articles: [] };
  if (old.version !== 1) throw new Error('Unsupported local archive');
  validateArticles(old.articles, true);
  const { text } = await readPublic(`${ORIGIN}/api/blog/archive`, fetcher, 'application/json');
  const manifest = JSON.parse(text);
  if (manifest.version !== 1) throw new Error('Unsupported public export');
  validateArticles(manifest.articles);
  if (!manifest.articles.length) throw new Error('Refusing an empty public export');
  const records = new Map(old.articles.map(article => [`${article.locale}/${article.slug}`, article]));
  const writes = new Map(); let downloaded = 0; let pending = 0;
  for (const article of manifest.articles) {
    const key = `${article.locale}/${article.slug}`;
    await rejectSymlinks(root, `docs/blog/${key}.md`);
    const previous = records.get(key);
    const saved = await fileOrNull(join(archive, `${key}.md`));
    if (previous?.revision === article.revision && saved !== null && hash(saved) === previous.sha256) continue;
    if (downloaded >= maxDownloads) { pending++; continue; }
    const { text: markdown, response } = await readPublic(`${ORIGIN}/api/blog/archive/${article.slug}?locale=${article.locale}`, fetcher, 'text/markdown');
    if (!markdown.startsWith('# ') || response.headers.get('content-language') !== article.locale || response.headers.get('x-content-sha256') !== hash(markdown)) throw new Error('Invalid Markdown export');
    writes.set(`${key}.md`, markdown);
    records.set(key, { slug: article.slug, locale: article.locale, title: article.title, published: article.published, revision: article.revision, sha256: hash(markdown) });
    downloaded++;
  }
  // Keep earlier published copies; a failed/partial feed never deletes the archive.
  const articles = [...records.values()].sort((a, b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug, 'en') || a.locale.localeCompare(b.locale, 'en'));
  const intro = '# OrbitPage blog archive\n\nPublished OrbitPage articles in Markdown, grouped by language. Read them here or on the [OrbitPage blog](https://orbitpage.com/en-US/blog).\n\nThis archive includes English originals and completed translations. Images remain linked to their public hosts. Earlier copies remain in Git history; this is a reading archive, not a database backup.\n\n';
  const locales = Object.entries(LANGUAGES).filter(([locale]) => articles.some(article => article.locale === locale));
  const navigation = locales.map(([locale, name]) => `[${name}](./${locale}/README.md)`).join(' · ');
  const sources = articles.filter(article => article.locale === 'en');
  writes.set('README.md', `${intro}${navigation}\n\n| Published | Article | Languages |\n| --- | --- | --- |\n${sources.map(article => `| ${article.published} | [${label(article.title)}](./en/${article.slug}.md) | ${articles.filter(item => item.slug === article.slug).map(item => `[${LANGUAGES[item.locale]}](./${item.locale}/${item.slug}.md)`).join(' · ')} |`).join('\n')}\n`);
  for (const [locale, name] of locales) {
    writes.set(`${locale}/README.md`, `# OrbitPage blog — ${name}\n\n[All languages](../README.md)\n\n${articles.filter(article => article.locale === locale).map(article => `- ${article.published} — [${label(article.title)}](./${article.slug}.md)`).join('\n')}\n`);
  }
  writes.set('manifest.json', `${JSON.stringify({ version: 1, articles }, null, 2)}\n`);
  let changed = 0;
  // Complete all network requests and validations before the first write.
  for (const path of writes.keys()) {
    if (!/^(?:README\.md|manifest\.json|[a-z]{2}\/(?:README|[a-z0-9]+(?:-[a-z0-9]+)*)\.md)$/.test(path)) throw new Error('Destination outside the archive');
    await rejectSymlinks(root, `docs/blog/${path}`);
  }
  for (const [path, content] of writes) {
    const target = join(archive, path);
    if (await fileOrNull(target) === content) continue;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8'); changed++;
  }
  return { downloaded, pending, changed, articles: articles.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await syncBlogArchive()));
}
