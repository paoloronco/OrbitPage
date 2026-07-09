import { describe, expect, it } from 'vitest';
import {
  ChangePasswordBodySchema,
  CreateUserBodySchema,
  LoginBodySchema,
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
