import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./LinkManager.tsx', import.meta.url), 'utf8');

describe('Shop link shortcut', () => {
  it('adds one native relative Shop destination from the main content editor', () => {
    expect(source).toContain("destination.kind === 'shop'");
    expect(source).toContain("url: shop.path");
    expect(source).toContain("type: 'link'");
    expect(source).toContain('atBlockLimit || hasShopLink');
    expect(source).toContain('tr("Add Shop", "Aggiungi Shop")');
  });
});
