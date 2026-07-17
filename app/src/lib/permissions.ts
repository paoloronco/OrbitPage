export type Permission =
  | 'links:write'
  | 'links:style'
  | 'links:images'
  | 'theme:write'
  | 'profile:write'
  | 'menu:write'
  | 'analytics:read'
  | 'compliance:write'
  | 'users:manage';

export type UserRole =
  | 'admin'
  | 'editor'
  | 'links_editor'
  | 'links_style'
  | 'links_images'
  | 'theme_editor'
  | 'compliance'
  | 'viewer';

export const ROLES: UserRole[] = [
  'admin', 'editor', 'links_editor', 'links_style', 'links_images',
  'theme_editor', 'compliance', 'viewer',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:        'Admin',
  editor:       'Editor',
  links_editor: 'Link Editor',
  links_style:  'Style Editor',
  links_images: 'Image Editor',
  theme_editor: 'Theme Editor',
  compliance:   'Compliance',
  viewer:       'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:        'Full access to everything',
  editor:       'Edit links, profile, and view analytics',
  links_editor: 'Edit all link fields and view analytics',
  links_style:  'Edit card styles (colors, fonts, size) only',
  links_images: 'Edit card icons and cover images only',
  theme_editor: 'Edit theme and background only',
  compliance:   'Edit privacy and cookie settings only',
  viewer:       'View-only access to analytics',
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin:        ['links:write', 'links:style', 'links:images', 'theme:write', 'profile:write', 'menu:write', 'analytics:read', 'compliance:write', 'users:manage'],
  editor:       ['links:write', 'profile:write', 'menu:write', 'analytics:read'],
  links_editor: ['links:write', 'analytics:read'],
  links_style:  ['links:style'],
  links_images: ['links:images'],
  theme_editor: ['theme:write'],
  compliance:   ['compliance:write'],
  viewer:       ['analytics:read'],
};

export const hasPermission = (permissions: Permission[], permission: Permission): boolean =>
  permissions.includes(permission);

export const hasAnyPermission = (permissions: Permission[], ...toCheck: Permission[]): boolean =>
  toCheck.some(p => permissions.includes(p));

/** Derive an edit mode for the Links tab from the user's permission set. */
export type LinkEditMode = 'full' | 'style' | 'images' | 'view';

export const getLinkEditMode = (permissions: Permission[]): LinkEditMode => {
  if (permissions.includes('links:write')) return 'full';
  if (permissions.includes('links:style') && permissions.includes('links:images')) return 'full';
  if (permissions.includes('links:style')) return 'style';
  if (permissions.includes('links:images')) return 'images';
  return 'view';
};
