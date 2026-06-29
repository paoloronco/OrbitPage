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
  usersApi: {
    list: vi.fn(),
    create: vi.fn(),
    changePassword: vi.fn(),
    delete: vi.fn(),
    updateRole: vi.fn(),
  },
}));

import { UserManager } from './UserManager';

describe('UserManager demo mode', () => {
  it('still shows the add-user action in demo mode', () => {
    const html = renderToStaticMarkup(<UserManager />);

    expect(html).toContain('Add user');
  });
});
