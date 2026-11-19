import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { checkMarkdown, markdownAnchors, markdownLinks } from './check-markdown-links.mjs';

function fixture(t, contents) {
  const prefix = join(tmpdir(), 'orbitpage-docs-');
  const root = mkdtempSync(prefix);
  t.after(() => {
    assert.ok(resolve(root).startsWith(resolve(prefix)));
    rmSync(root, { recursive: true, force: true });
  });
  for (const [file, content] of Object.entries(contents)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return { root, files: Object.keys(contents).filter(file => file.endsWith('.md')) };
}

test('validates section bookmarks, HTML anchors, images and code links', t => {
  const { root, files } = fixture(t, {
    'README.md': '# Project\n[Guide](docs/Guide.md#save)\n![Preview](docs/preview.svg)\n<a href="docs/Guide.md#legacy">Old link</a>',
    'docs/Guide.md': '# Guide\n## Save\n<a id="legacy"></a>\n[Code](../src/index.js)',
    'docs/preview.svg': '<svg/>',
    'src/index.js': '// fixture',
  });
  assert.deepEqual(checkMarkdown(root, files), []);
});

test('rejects broken files and section bookmarks, including links within a page', t => {
  const { root, files } = fixture(t, {
    'README.md': '# Project\n[Missing](docs/absent.md)\n[Wrong section](docs/Guide.md#absent)\n[Local](#absent)',
    'docs/Guide.md': '# Guide',
  });
  const failures = checkMarkdown(root, files);
  assert.equal(failures.length, 3);
  assert.match(failures.join('\n'), /missing file/);
  assert.equal(failures.filter(item => item.includes('missing section anchor')).length, 2);
});

test('rejects incorrect path case on both case-sensitive and insensitive filesystems', t => {
  const { root, files } = fixture(t, {
    'README.md': '[Guide](docs/guide.md)',
    'docs/Guide.md': '# Guide',
  });
  assert.match(checkMarkdown(root, files, { checkReachability: false })[0], /missing file|incorrect path case/);
});

test('ignores links and headings in code examples and external destinations', t => {
  const { root, files } = fixture(t, {
    'README.md': '# Project\n```md\n[Example](missing.md)\n## Not a section\n```\n`[Code](missing.md)`\n[Website](https://example.com/no-local-file)\n[Email](mailto:contact@example.com)',
  });
  assert.deepEqual(checkMarkdown(root, files), []);
  assert.deepEqual([...markdownAnchors('~~~md\n## Hidden\n~~~\n## Visible')], ['visible']);
});

test('checks reference links and rejects undefined explicit references', t => {
  const { root, files } = fixture(t, {
    'README.md': '[Guide][ref]\n[ref]: docs/Guide.md#intro "Guide"\n[Missing][undefined]',
    'docs/Guide.md': '# Guide\n## Intro',
  });
  assert.deepEqual(checkMarkdown(root, files), ['README.md -> unresolved-reference:undefined']);
});

test('finds disconnected documents while following directory indexes and cycles', t => {
  const { root, files } = fixture(t, {
    'README.md': '[Docs](docs/)',
    'docs/README.md': '# Docs\n[Guide](Guide.md)',
    'docs/Guide.md': '# Guide\n[Return](README.md)',
    'docs/orphan.md': '# Unlisted guide',
  });
  assert.deepEqual(checkMarkdown(root, files), ['docs/orphan.md is unreachable from README.md']);
});

test('preserves duplicate heading suffixes, code identifiers and explicit legacy IDs', () => {
  const headings = '# Guide\n## Save\n## Save\n## Save-1\n## `PUBLIC_SITE_URL`\nSection\n---\n<a id="old-save"></a>';
  assert.deepEqual([...markdownAnchors(headings)], ['guide', 'save', 'save-1', 'save-1-1', 'public_site_url', 'section', 'old-save']);
});

test('checks encoded filenames and rejects malformed encoding or repository escape', t => {
  const { root, files } = fixture(t, {
    'README.md': '[Space](<docs/Long%20name.md#intro>)\n[Parentheses](docs/Guide(v2).md)\n[Escape](../outside.md)\n[Invalid](docs/%ZZ.md)',
    'docs/Long name.md': '# Guide\n## Intro',
    'docs/Guide(v2).md': '# Guide',
  });
  const failures = checkMarkdown(root, files);
  assert.equal(failures.length, 2);
  assert.match(failures[0], /outside repository/);
  assert.match(failures[1], /URI malformed/);
  assert.deepEqual(markdownLinks('[One](<Long name.md> "Title")'), ['Long name.md']);
});
