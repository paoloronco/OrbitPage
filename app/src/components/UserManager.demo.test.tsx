import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const language = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('@/lib/i18n', async () => {
  const { default: dutch } = await import('@/lib/translations/nl.json');
  return { useAppI18n: () => ({ tr: (english: string) => language.locale === 'nl' ? (dutch[english as keyof typeof dutch] || english) : english }) };
});

vi.mock('@/lib/config', () => ({
  DEMO_MODE: true,
}));

vi.mock('@/lib/auth', () => ({
  isPasswordStrong: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  usersApi: {
    list: vi.fn(),
    create: vi.fn(),
    changePassword: vi.fn(),
    delete: vi.fn(),
    updateRole: vi.fn(),
  },
}));

import { UserManager } from './UserManager';

const source = readFileSync(new URL('./UserManager.tsx', import.meta.url), 'utf8');

describe('UserManager demo mode', () => {
  beforeEach(() => { language.locale = 'en'; });

  it('still shows the add-user action in demo mode', () => {
    const html = renderToStaticMarkup(<UserManager />);

    expect(html).toContain('Add user');
  });

  it('keeps role management inline like the hosted member list', () => {
    expect(source).toContain('onChange={(event) => void handleRoleChange(u.username, event.target.value)}');
    expect(source).not.toContain("setEditMode('role')");
  });

  it('localizes the add-user action with the dashboard language', () => {
    language.locale = 'nl';
    expect(renderToStaticMarkup(<UserManager />)).toContain('Gebruiker toevoegen');
  });
});
