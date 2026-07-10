import { z } from 'zod';

export const UserRoleSchema = z.enum([
  'admin',
  'editor',
  'links_editor',
  'links_style',
  'links_images',
  'theme_editor',
  'compliance',
  'viewer',
]);

export const UsernameSchema = z
  .string({ required_error: 'Username is required' })
  .trim()
  .regex(/^[a-zA-Z0-9_-]{3,32}$/, 'Username must be 3-32 alphanumeric characters (underscores and hyphens allowed)');

const RequiredPasswordSchema = z.string({ required_error: 'Password is required' }).min(1, 'Password is required');

export const SetupBodySchema = z.object({
  password: RequiredPasswordSchema,
});

export const LoginBodySchema = z.object({
  username: UsernameSchema.default('admin'),
  password: RequiredPasswordSchema,
});

export const CreateUserBodySchema = z.object({
  username: UsernameSchema,
  password: RequiredPasswordSchema,
  role: UserRoleSchema.optional().default('viewer'),
});

export const UpdateUserPasswordBodySchema = z.object({
  password: z.string({ required_error: 'New password is required' }).min(1, 'New password is required'),
});

export const UpdateRoleBodySchema = z.object({
  role: UserRoleSchema,
});

export const ChangePasswordBodySchema = z.object({
  currentPassword: z.string({ required_error: 'Current password is required' }).min(1),
  newPassword: z.string({ required_error: 'New password is required' }).min(1),
});

export const ResetViaTokenBodySchema = z.object({
  token: z.string({ required_error: 'Reset token is required' }).min(1, 'Reset token is required'),
  newPassword: z.string({ required_error: 'New password is required' }).min(1),
});
