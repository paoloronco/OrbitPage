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

const RESERVED_PAGE_SLUGS = new Set([
  'about', 'admin', 'ai', 'api', 'assets', 'cookies', 'dashboard', 'health', 'humans',
  'llm', 'llms', 'login', 'media', 'menu', 'orbitpage-runtime', 'privacy', 'robots',
  'security', 'sitemap', 'support', 'terms', 'uploads', 'www',
]);

export const PageSlugSchema = z
  .string({ required_error: 'Page slug is required' })
  .trim()
  .toLowerCase()
  .min(3, 'Page slug must contain at least 3 characters')
  .max(48, 'Page slug must contain at most 48 characters')
  .regex(/^[a-z0-9](?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/, 'Use lowercase letters, numbers, and single hyphens only')
  .refine((slug) => !RESERVED_PAGE_SLUGS.has(slug), 'This page slug is reserved');

export const SetupBodySchema = z.object({
  password: RequiredPasswordSchema,
  slug: PageSlugSchema,
});

export const LoginBodySchema = z.object({
  username: UsernameSchema.default('admin'),
  password: RequiredPasswordSchema,
});

export const TwoFactorVerifyBodySchema = z.object({
  challengeToken: z.string().min(20).max(4096),
  code: z.string().trim().min(6).max(32),
});

export const TwoFactorCodeBodySchema = z.object({
  code: z.string().trim().min(6).max(32),
});

export const TwoFactorManageBodySchema = TwoFactorCodeBodySchema.extend({
  currentPassword: RequiredPasswordSchema,
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
