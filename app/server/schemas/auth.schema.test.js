import { describe, expect, it } from 'vitest';
import {
  ChangePasswordBodySchema,
  CreateUserBodySchema,
  LoginBodySchema,
  PersonalPageActionBodySchema,
  ResetApplicationBodySchema,
  ResetViaTokenBodySchema,
  SetupBodySchema,
  UpdateRoleBodySchema,
  UpdateUserPasswordBodySchema,
} from './auth.schema.js';

describe('auth schemas', () => {
  it('defaults login username to admin', () => {
    expect(LoginBodySchema.parse({ password: 'Secret123!' })).toEqual({
      username: 'admin',
      password: 'Secret123!',
    });
  });

  it('requires passwords for setup and password changes', () => {
    expect(() => SetupBodySchema.parse({})).toThrow();
    expect(() => ChangePasswordBodySchema.parse({ currentPassword: 'old' })).toThrow();
    expect(() => UpdateUserPasswordBodySchema.parse({})).toThrow();
    expect(() => ResetViaTokenBodySchema.parse({ token: 'reset-token' })).toThrow();
    expect(() => ResetApplicationBodySchema.parse({})).toThrow();
    expect(ResetViaTokenBodySchema.parse({
      token: '12345678901234567890123456789012',
      newPassword: 'Secret123!',
    }).token).toHaveLength(32);
  });

  it('does not require a page slug during setup', () => {
    const setup = { password: 'Secret123!', setupToken: 'a'.repeat(64) };
    expect(SetupBodySchema.parse(setup)).toEqual(setup);
    expect(SetupBodySchema.parse({ ...setup, slug: 'legacy-page' })).toEqual(setup);
    expect(SetupBodySchema.parse({ password: 'Secret123!' })).toEqual({ password: 'Secret123!' });
    expect(() => SetupBodySchema.parse({ password: 'Secret123!', setupToken: 'invalid' })).toThrow();
  });

  it('validates personal page creation and destructive confirmation separately', () => {
    expect(PersonalPageActionBodySchema.parse({ action: 'create' })).toEqual({ action: 'create' });
    expect(PersonalPageActionBodySchema.parse({ action: 'set-slug', slug: 'new-page' })).toEqual({ action: 'set-slug', slug: 'new-page' });
    expect(PersonalPageActionBodySchema.parse({ action: 'delete', confirmation: 'REMOVE my-page', currentPassword: 'Secret123!' })).toMatchObject({ action: 'delete' });
    expect(() => PersonalPageActionBodySchema.parse({ action: 'delete', confirmation: 'REMOVE my-page' })).toThrow();
  });

  it('validates user names and roles for user management', () => {
    expect(CreateUserBodySchema.parse({
      username: 'editor_1',
      password: 'Secret123!',
      role: 'editor',
    }).role).toBe('editor');
    expect(() => CreateUserBodySchema.parse({ username: '../admin', password: 'Secret123!' })).toThrow();
    expect(() => UpdateRoleBodySchema.parse({ role: 'owner' })).toThrow();
  });
});
