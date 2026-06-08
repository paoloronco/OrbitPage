import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  DEMO_MODE: true,
}));

vi.mock('@/lib/auth', () => ({
  isPasswordStrong: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  authApi: {
    verify: vi.fn(),
    changePassword: vi.fn(),
    reset: vi.fn(),
    logout: vi.fn(),
  },
}));

import { PasswordManager } from './PasswordManager';

const inputWithDisabled = (html: string, id: string) =>
  new RegExp(`<input(?=[^>]*id="${id}")(?=[^>]*disabled="")`).test(html);

describe('PasswordManager demo mode', () => {
  it('disables password change controls when demo mode is active', () => {
    const html = renderToStaticMarkup(<PasswordManager />);

    expect(html).toContain('Password change is disabled in demo mode.');
    expect(inputWithDisabled(html, 'current-password')).toBe(true);
    expect(inputWithDisabled(html, 'new-password')).toBe(true);
    expect(inputWithDisabled(html, 'confirm-password')).toBe(true);
    expect(html).toMatch(/<button(?=[^>]*disabled="")[^>]*>Change Password<\/button>/);
  });
});
