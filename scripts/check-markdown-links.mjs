import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// These small compatibility pages retain old bookmarks; new readers use the wiki index.
const compatibilityPages = new Set([
  'docs/wiki/Deployment.md', 'docs/wiki/Docker-Hub-migration.md',
  'docs/wiki/account-and-team.md', 'docs/wiki/api.md',
]);

export function withoutFencedCode(content) {
  let fence;
  return content.split(/\r?\n/).map(line => {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length) fence = undefined;
      return '';
    }
    return fence ? '' : line;
  }).join('\n');
}

export function markdownAnchors(content) {
  const anchors = new Set();
  const headings = new Set();
  const lines = withoutFencedCode(content).split('\n');
  const addHeading = heading => {
    const base = heading.replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]*>/g, '').replace(/[`*~]/g, '').trim().toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/ /g, '-');
    let slug = base;
    for (let index = 1; headings.has(slug); index++) slug = `${base}-${index}`;
    headings.add(slug);
    anchors.add(slug);
  };
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].match(/^ {0,3}#{1,6}(?:\s+|$)(.*)$/);
    if (heading) addHeading(heading[1].replace(/\s+#+\s*$/, ''));
    else if (lines[index].trim() && /^ {0,3}(?:=+|-+)\s*$/.test(lines[index + 1] || '')) {
      addHeading(lines[index++].trim());
    }
  }
  for (const match of lines.join('\n').matchAll(/<(?:[a-z][\w:-]*)\b[^>]*\b(?:id|name)=["']([^"']+)["']/gi)) anchors.add(match[1]);
  return anchors;
}

export function markdownLinks(content) {
  const text = withoutFencedCode(content).replace(/(`+)[^\n]*?\1/g, '');
  const links = [];
  const references = new Map();
  for (const match of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)/gm)) references.set(match[1].trim().toLowerCase(), match[2]);
  for (const match of text.matchAll(/!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|(?:[^()\s\\]|\\.|\([^()\n]*\))+)(?:\s+["'][^\n]*["'])?\s*\)/g)) links.push(match[1]);
  for (const match of text.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
    const reference = (match[2] || match[1]).trim().toLowerCase();
    links.push(references.get(reference) || `unresolved-reference:${reference}`);
  }
  // Reference definitions also cover shortcut references, without interpreting checkboxes as links.
  links.push(...references.values());
  for (const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) links.push(match[1]);
  return [...new Set(links.map(link => link.replace(/^<|>$/g, '').replace(/\\([()])/g, '$1')))];
}

function withinRoot(root, target) {
  const path = relative(root, target);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function exactPath(root, target) {
  let parent = root;
  for (const segment of relative(root, target).split(sep).filter(Boolean)) {
    if (!readdirSync(parent).includes(segment)) return false;
    parent = join(parent, segment);
  }
  return true;
}

export function checkMarkdown(root, files, { checkReachability = true } = {}) {
  root = resolve(root);
  const failures = [];
  const graph = new Map();
  const anchorCache = new Map();
  for (const file of files) {
    const source = resolve(root, file);
    const edges = new Set();
    graph.set(source, edges);
    for (const href of markdownLinks(readFileSync(source, 'utf8'))) {
      if (href.startsWith('unresolved-reference:')) {
        failures.push(`${file} -> ${href}`);
        continue;
      }
      if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href)) continue;
      try {
        const [pathAndQuery, hash] = href.split('#');
        const path = decodeURIComponent(pathAndQuery.split('?')[0]);
        const target = path ? resolve(dirname(source), path) : source;
        if (!withinRoot(root, target)) throw new Error('outside repository');
        if (!existsSync(target)) throw new Error('missing file');
        if (!exactPath(root, target)) throw new Error('incorrect path case');
        const markdown = statSync(target).isDirectory() ? join(target, 'README.md') : target;
        if (extname(markdown).toLowerCase() !== '.md' || !existsSync(markdown)) continue;
        edges.add(markdown);
        if (hash) {
          if (!anchorCache.has(markdown)) anchorCache.set(markdown, markdownAnchors(readFileSync(markdown, 'utf8')));
          if (!anchorCache.get(markdown).has(decodeURIComponent(hash))) throw new Error('missing section anchor');
        }
      } catch (error) {
        failures.push(`${file} -> ${href} (${error.message})`);
      }
    }
  }
  if (checkReachability) {
    const reached = new Set();
    const visit = path => {
      if (reached.has(path)) return;
      reached.add(path);
      for (const next of graph.get(path) || []) visit(next);
    };
    visit(join(root, 'README.md'));
    for (const file of files.filter(file => file.startsWith('docs/') && !compatibilityPages.has(file))) {
      if (!reached.has(resolve(root, file))) failures.push(`${file} is unreachable from README.md`);
    }
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const failures = checkMarkdown(root, files);
  if (failures.length) {
    console.error(`Documentation checks failed:\n${failures.map(item => `- ${item}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Documentation OK: ${files.length} Markdown files; local links, exact path case, section anchors and index reachability checked.`);
  }
}
