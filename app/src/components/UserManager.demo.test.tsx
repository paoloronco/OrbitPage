import React from 'react';
import { readFileSync } from 'node:fs';
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

const source = readFileSync(new URL('./UserManager.tsx', import.meta.url), 'utf8');

describe('UserManager demo mode', () => {
  it('still shows the add-user action in demo mode', () => {
    const html = renderToStaticMarkup(<UserManager />);

    expect(html).toContain('Add user');
  });

  it('keeps role management inline like the hosted member list', () => {
    expect(source).toContain('onChange={(event) => void handleRoleChange(u.username, event.target.value)}');
    expect(source).not.toContain("setEditMode('role')");
  });
});
