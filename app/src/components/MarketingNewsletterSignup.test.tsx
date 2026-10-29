import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarketingNewsletterSignup } from './MarketingNewsletterSignup';

describe('optional OrbitPage newsletter signup', () => {
  it('requires an email and unchecked explicit consent, with only a public OrbitPage form destination', () => {
    const html = renderToStaticMarkup(<MarketingNewsletterSignup />);
    expect(html).toContain('action="https://orbitpage.com/api/marketing/subscribe"');
    expect(html).toContain('method="post"');expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toMatch(/type="email"[^>]*required/);
    expect(html).toMatch(/type="checkbox"[^>]*required/);
    expect(html).not.toContain('checked=""');
    expect(html).toContain('Confirm by email');expect(html).toContain('unsubscribe');
    expect(html).toContain('href="https://orbitpage.com/newsletter"');
    expect(html).not.toMatch(/n8n|webhook|Authorization|Bearer|secret|token/i);
    expect([...html.matchAll(/name="([^"]+)"/g)].map(match => match[1]).sort()).toEqual(['consent', 'email', 'locale', 'source']);
  });
});
