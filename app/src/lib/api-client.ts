import { apiPath } from './base-path';

// --- Secure token storage (AES-GCM via Web Crypto with sessionStorage fallback) ---
//
// Web Crypto (crypto.subtle) is only available in "secure contexts": HTTPS or localhost.
// When accessed over plain HTTP via an IP address, crypto.subtle is undefined and we fall
// back to storing the token unencrypted in sessionStorage (cleared on tab close).
// The token is always validated server-side on every request, so this is safe in practice.
const TOKEN_STORAGE_KEY = 'orbitpage-auth-token';
const TOKEN_IV_PREFIX = 'orbitpage-auth-iv-';
const DEVICE_SECRET_KEY = 'orbitpage-device-secret';
const TOKEN_FALLBACK_KEY = 'orbitpage-auth-token-plain';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Returns true when the Web Crypto subtle API is usable (secure context). */
const isCryptoAvailable = (): boolean =>
  typeof crypto !== 'undefined' && !!crypto.subtle;

const getCryptoOrThrow = (): Crypto => {
  if (isCryptoAvailable()) return crypto as Crypto;
  throw new Error('Web Crypto API is not available');
};

const getOrCreateDeviceSecret = (): Uint8Array => {
  const existing = localStorage.getItem(DEVICE_SECRET_KEY);
  if (existing) {
    return Uint8Array.from(atob(existing), c => c.charCodeAt(0));
  }
  const buf = new Uint8Array(32);
  getCryptoOrThrow().getRandomValues(buf);
  const b64 = btoa(String.fromCharCode(...buf));
  localStorage.setItem(DEVICE_SECRET_KEY, b64);
  return buf;
};

const deriveKey = async (): Promise<CryptoKey> => {
  const cryptoObj = getCryptoOrThrow();
  const deviceSecret = getOrCreateDeviceSecret();
  const salt = textEncoder.encode(location.origin);

  // Web Crypto expects a BufferSource; pass the underlying ArrayBuffer for correct typing
  const baseKey = await cryptoObj.subtle.importKey(
    'raw',
    deviceSecret.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

const encryptToken = async (token: string): Promise<{ ivB64: string; ctB64: string }> => {
  const cryptoObj = getCryptoOrThrow();
  const key = await deriveKey();
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const ciphertext = await cryptoObj.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(token)
  );
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return { ivB64, ctB64 };
};

const decryptToken = async (ivB64: string, ctB64: string): Promise<string | null> => {
  try {
    const cryptoObj = getCryptoOrThrow();
    const key = await deriveKey();
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
    const plaintext = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    );
    return textDecoder.decode(plaintext);
  } catch {
    return null;
  }
};

// Get auth token quickly if cached; otherwise null
const getAuthToken = (): string | null => {
  // Fallback path: plain sessionStorage (non-secure context)
  if (!isCryptoAvailable()) {
    return sessionStorage.getItem(TOKEN_FALLBACK_KEY);
  }

  const ctB64 = localStorage.getItem(TOKEN_STORAGE_KEY);
  const ivB64 = localStorage.getItem(TOKEN_IV_PREFIX + TOKEN_STORAGE_KEY);
  if (!ctB64 || !ivB64) return null;
  // Synchronous callers expect a string; we cannot block on async here.
  // For simplicity, decrypt synchronously via microtask by caching the last token.
  // We'll maintain a small cache.
  const cached = (window as any).__orbitpageTokenCache as { iv: string; ct: string; val: string } | undefined;
  if (cached && cached.iv === ivB64 && cached.ct === ctB64) {
    return cached.val;
  }
  return null;
};

const hasStoredAuthToken = (): boolean => {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TOKEN_FALLBACK_KEY)) {
      return true;
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  try {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(
      localStorage.getItem(TOKEN_STORAGE_KEY) &&
      localStorage.getItem(TOKEN_IV_PREFIX + TOKEN_STORAGE_KEY)
    );
  } catch {
    return false;
  }
};

// Async variant for flows that can await (API calls)
const getAuthTokenAsync = async (): Promise<string | null> => {
  // Fallback path: plain sessionStorage (non-secure context)
  if (!isCryptoAvailable()) {
    return sessionStorage.getItem(TOKEN_FALLBACK_KEY);
  }

  const cached = getAuthToken();
  if (cached) return cached;
  const ctB64 = localStorage.getItem(TOKEN_STORAGE_KEY);
  const ivB64 = localStorage.getItem(TOKEN_IV_PREFIX + TOKEN_STORAGE_KEY);
  if (!ctB64 || !ivB64) return null;
  const val = await decryptToken(ivB64, ctB64);
  if (val) {
    (window as any).__orbitpageTokenCache = { iv: ivB64, ct: ctB64, val };
  }
  return val;
};

// Set auth token.
// In a secure context (HTTPS / localhost): AES-GCM encrypted in localStorage.
// In a non-secure context (HTTP over IP): stored unencrypted in sessionStorage.
// The token is always validated server-side, so both paths are functionally safe.
const setAuthToken = (token: string): Promise<void> => {
  if (!isCryptoAvailable()) {
    console.warn(
      'Web Crypto API unavailable (non-secure context). ' +
      'Token stored in sessionStorage without encryption. ' +
      'Use HTTPS or access via localhost for encrypted storage.'
    );
    sessionStorage.setItem(TOKEN_FALLBACK_KEY, token);
    (window as any).__orbitpageTokenCache = { iv: '', ct: '', val: token };
    return Promise.resolve();
  }

  return encryptToken(token).then(({ ivB64, ctB64 }) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, ctB64);
    localStorage.setItem(TOKEN_IV_PREFIX + TOKEN_STORAGE_KEY, ivB64);
    (window as any).__orbitpageTokenCache = { iv: ivB64, ct: ctB64, val: token };
  }).catch((err) => {
    // Encryption unexpectedly failed even though crypto.subtle was available.
    // Fall back to sessionStorage so the user can still log in.
    console.warn('Token encryption failed, falling back to sessionStorage:', err);
    sessionStorage.setItem(TOKEN_FALLBACK_KEY, token);
    (window as any).__orbitpageTokenCache = { iv: '', ct: '', val: token };
  });
};

// Remove auth token (both storage paths)
const removeAuthToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_IV_PREFIX + TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_FALLBACK_KEY);
  delete (window as any).__orbitpageTokenCache;
};

// Base response interface
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  token?: string;
}

// Auth specific types
interface AuthSetupResponse extends ApiResponse {
  isFirstTimeSetup?: boolean;
  token: string;
  user?: {
    username: string;
  };
}

interface LoginResponse extends ApiResponse {
  token: string;
  user: {
    username: string;
  };
}

interface VerifyResponse extends ApiResponse {
  valid: boolean;
  user?: {
    username: string;
    role?: string;
    permissions?: string[];
  };
}

interface SetupResponse extends ApiResponse {
  success: boolean;
  token: string;
  message: string;
}

interface ChangePasswordResponse extends ApiResponse {
  success: boolean;
  message: string;
  token?: string;
}

interface ProfileResponse extends ApiResponse {
  name: string;
  bio: string;
  avatar: string;
  social_links: Record<string, string>;
  show_avatar?: number;
  showAvatar?: boolean;
  name_font_size?: string;
  bio_font_size?: string;
  tab_title?: string;
  meta_description?: string;
  footer_text?: string;
  favicon?: string;
  google_analytics_id?: string;
  privacy_policy_url?: string;
  cookie_policy_url?: string;
  appearance?: import('./profile-appearance').ProfileAppearance;
}

interface LinkItem {
  id: string;
  title: string;
  description: string;
  url: string;
  type: string;
  icon?: string;
  // Support both camelCase and snake_case for API compatibility
  iconType?: 'emoji' | 'image' | 'svg';
  icon_type?: 'emoji' | 'image' | 'svg';
  backgroundColor?: string;
  textColor?: string;
  size?: 'small' | 'medium' | 'large';
  content?: string;
  textItems?: Array<{ text: string; url?: string }>;
  isActive?: boolean;
  clickCount?: number;
  ctaAction?: 'book' | 'contact' | 'download' | 'subscribe' | 'buy';
  ctaClicks?: number;
  status?: 'draft' | 'live' | 'expired';
  campaignName?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  timezone?: string;
  coverImage?: string;
  coverImageAlt?: string;
}

interface PublicPageResponse {
  profile: ProfileResponse;
  links: LinkItem[];
  theme: Record<string, any>;
}

// API request helper with auth
const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = await getAuthTokenAsync();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Prevent any caching of API responses and bust caches for GETs
  const method = (options.method || 'GET').toUpperCase();
  let url = apiPath(endpoint);
  if (method === 'GET') {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}_ts=${Date.now()}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
    });

    // Safely parse JSON — proxies (Cloudflare, nginx) and rate limiters may return
    // plain text (e.g. "Too many requests"), which would throw on response.json().
    let data: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      // Try to parse anyway in case the content-type header is wrong
      try { data = JSON.parse(text); } catch { data = { error: text || 'Unknown error' }; }
    }

    if (!response.ok) {
      const errorMessage = data?.error || data?.message || 'Request failed';
      const isAuthExpired =
        response.status === 401 ||
        (response.status === 403 && /invalid or expired token|user not found|access token required/i.test(errorMessage));

      // Only auth failures should clear the token. Other 403 responses are real
      // permission/product errors, for example demo-mode write protection.
      if (isAuthExpired) {
        removeAuthToken();
        throw new Error('AUTH_EXPIRED');
      }
      if (response.status === 429) {
        throw new Error(data?.error || 'Too many requests. Please wait a moment and try again.');
      }
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (error: any) {
    console.error(`API Request Error (${endpoint}):`, error);
    throw new Error(error.message || 'Failed to connect to the server');
  }
};

// Public page API
export const publicPageApi = {
  get: async (): Promise<PublicPageResponse> => {
    return apiRequest<PublicPageResponse>('/public-page');
  },
};

export const publicUrlApi = {
  get: async (): Promise<{ success: boolean; publicUrl: string; source: 'configured' | 'request' }> => {
    return apiRequest<{ success: boolean; publicUrl: string; source: 'configured' | 'request' }>('/public-url');
  },
};

// Auth API
export const authApi = {
  checkSetupStatus: async (): Promise<{ isFirstTimeSetup: boolean }> => {
    return apiRequest<{ isFirstTimeSetup: boolean }>('/auth/setup-status');
  },

  setup: async (password: string): Promise<SetupResponse> => {
    const response = await apiRequest<SetupResponse>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (response.token) {
      await setAuthToken(response.token);
    }
    return response;
  },

  login: async (password: string, username = 'admin'): Promise<LoginResponse> => {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (response.token) {
      await setAuthToken(response.token);
    }
    return response;
  },

  verify: async (): Promise<VerifyResponse> => {
    return apiRequest<VerifyResponse>('/auth/verify', { method: 'POST' });
  },

  logout: (): void => {
    removeAuthToken();
  },

  hasStoredToken: (): boolean => {
    return hasStoredAuthToken();
  },

  isAuthenticated: (): boolean => {
    return !!getAuthToken();
  },

  reset: async (): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>('/auth/reset', { method: 'POST' });
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> => {
    const response = await apiRequest<ChangePasswordResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (response.token) {
      await setAuthToken(response.token);
    }
    return response;
  },
};

export const backupApi = {
  download: async (): Promise<Blob> => {
    const token = await getAuthTokenAsync();
    const response = await fetch(apiPath('/admin/backup'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const errorData = await response.json().catch((): { error?: string } => ({}));
      throw new Error(errorData.error || 'Backup export failed');
    }

    return response.blob();
  },

  restore: async (backup: unknown): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>('/admin/restore', {
      method: 'POST',
      body: JSON.stringify(backup),
    });
  },
};

export interface TextFileConfig {
  key: 'robots' | 'llms' | 'humans' | 'security' | 'ai';
  path: string;
  aliases: string[];
  label: string;
  description: string;
  content: string;
  defaultContent: string;
  isCustomized: boolean;
  updatedAt: string | null;
}

export const textFilesApi = {
  get: async (): Promise<{ success: boolean; data: { files: TextFileConfig[]; demoMode: boolean } }> => {
    return apiRequest<{ success: boolean; data: { files: TextFileConfig[]; demoMode: boolean } }>('/text-files');
  },

  update: async (key: TextFileConfig['key'], content: string): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>(`/text-files/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  reset: async (key: TextFileConfig['key']): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>(`/text-files/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  },
};

// Page/Profile API
export const profileApi = {
  get: async (): Promise<ProfileResponse> => {
    return apiRequest<ProfileResponse>('/profile').then((resp) => {
      const showAvatar = typeof (resp as any).show_avatar !== 'undefined'
        ? ((resp as any).show_avatar !== 0)
        : (typeof (resp as any).showAvatar !== 'undefined' ? (resp as any).showAvatar : true);
      return { ...(resp as any), showAvatar } as ProfileResponse;
    });
  },

  update: async (profile: { name: string; bio: string; avatar: string; socialLinks: Record<string, string>; showAvatar?: boolean; nameFontSize?: string; bioFontSize?: string; tabTitle?: string; metaDescription?: string; footerText?: string; favicon?: string; googleAnalyticsId?: string; privacyPolicyUrl?: string; cookiePolicyUrl?: string; adminOnboardingEnabled?: boolean; appearance?: import('./profile-appearance').ProfileAppearance }): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>('/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: profile.name,
        bio: profile.bio,
        avatar: profile.avatar,
        social_links: profile.socialLinks || {},
        // backend expects snake_case; send numeric boolean for SQLite
        show_avatar: typeof profile.showAvatar === 'boolean' ? (profile.showAvatar ? 1 : 0) : 1,
        name_font_size: profile.nameFontSize || undefined,
        bio_font_size: profile.bioFontSize || undefined,
        tab_title: profile.tabTitle || undefined,
        meta_description: profile.metaDescription || undefined,
        footer_text: profile.footerText ?? undefined,
        favicon: profile.favicon ?? undefined,
        google_analytics_id: profile.googleAnalyticsId ?? undefined,
        privacy_policy_url: profile.privacyPolicyUrl ?? undefined,
        cookie_policy_url: profile.cookiePolicyUrl ?? undefined,
        admin_onboarding_enabled: typeof profile.adminOnboardingEnabled === 'boolean' ? (profile.adminOnboardingEnabled ? 1 : 0) : undefined,
        appearance: profile.appearance,
      }),
    });
  },
};

// Users management API
export const usersApi = {
  list: async (): Promise<{ username: string; created_at: string; role: string }[]> => {
    return apiRequest<{ username: string; created_at: string; role: string }[]>('/users');
  },

  create: async (username: string, password: string, role = 'viewer'): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
  },

  changePassword: async (username: string, password: string): Promise<ApiResponse & { token?: string }> => {
    const response = await apiRequest<ApiResponse & { token?: string }>(`/users/${encodeURIComponent(username)}`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
    if (response.token) {
      await setAuthToken(response.token);
    }
    return response;
  },

  delete: async (username: string): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>(`/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });
  },

  updateRole: async (username: string, role: string): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>(`/users/${encodeURIComponent(username)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },
};

// Links API
export const linksApi = {
  get: async (): Promise<LinkItem[]> => {
    return apiRequest<LinkItem[]>('/links');
  },

  update: async (links: LinkItem[]): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>('/links', {
      method: 'PUT',
      body: JSON.stringify(links),
    });
  },

  export: async (): Promise<Blob> => {
    try {
      const token = await getAuthTokenAsync();
      const resp = await fetch(apiPath('/links/export'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Export failed');
      }
      
      return await resp.blob();
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  },

  import: async (data: any[]): Promise<ApiResponse> => {
    try {
      return await apiRequest<ApiResponse>('/links/import', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  },

  trackClick: async (id: string): Promise<void> => {
    try {
      await fetch(apiPath(`/links/${encodeURIComponent(id)}/click`), { method: 'POST' });
    } catch { /* fire-and-forget, don't break the UI */ }
  },

  patchStyle: async (id: string, style: {
    backgroundColor?: string; textColor?: string;
    titleFontFamily?: string; descriptionFontFamily?: string;
    alignment?: string; titleFontSize?: string; descriptionFontSize?: string;
    size?: string;
  }): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>(`/links/${encodeURIComponent(id)}/style`, {
      method: 'PATCH',
      body: JSON.stringify(style),
    });
  },

  patchIcon: async (id: string, icon: {
    icon?: string | null; iconType?: string | null;
    coverImage?: string | null; coverImageAlt?: string | null;
  }): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>(`/links/${encodeURIComponent(id)}/icon`, {
      method: 'PATCH',
      body: JSON.stringify(icon),
    });
  },
};

// Theme API
export const themeApi = {
  get: async (): Promise<Record<string, any>> => {
    return apiRequest<Record<string, any>>('/theme');
  },

  update: async (theme: Record<string, any>): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>('/theme', {
      method: 'PUT',
      body: JSON.stringify(theme),
    });
  },
};

// Background media upload API
export const uploadApi = {
  uploadBackgroundMedia: async (file: File): Promise<{ filePath: string; fullUrl: string; fileName: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const token = await getAuthTokenAsync();
    const response = await fetch(apiPath('/upload/background'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).error || 'Upload failed');
    }
    return response.json();
  },
};

// ---- Consent Config API ----

/** Shape of the full consent configuration persisted in the DB. */
export interface ConsentConfigData {
  mode: 'disabled' | 'hardcoded' | 'builder';
  enabled: boolean;
  legalPolicies?: {
    showFooterLinks: boolean;
    privacyPolicy: {
      mode: 'external' | 'hosted' | 'embedded';
      externalUrl?: string;
      hostedText?: string;
      hostedFileName?: string;
      embeddedCode?: string;
    };
    cookiePolicy: {
      mode: 'external' | 'hosted' | 'embedded';
      externalUrl?: string;
      hostedText?: string;
      hostedFileName?: string;
      embeddedCode?: string;
    };
  };
  hardcoded?: {
    policyVersion: string;
    texts: {
      title: string;
      description: string;
      acceptAll: string;
      rejectAll: string;
      managePreferences: string;
      savePreferences: string;
      reopenLabel: string;
      privacyPolicyLinkText: string;
      cookiePolicyLinkText: string;
    };
    urls: { privacyPolicy: string; cookiePolicy: string };
    categories: {
      preferences: { enabled: boolean; title: string; description: string };
      analytics:   { enabled: boolean; title: string; description: string };
      marketing:   { enabled: boolean; title: string; description: string };
    };
    layout: 'bottom-bar' | 'centered-modal' | 'corner-popup';
    theme: 'light' | 'dark' | 'auto';
    buttonPriority: 'equal' | 'reject-first';
    geoMode: 'global' | 'eu-only' | 'always';
    consentExpiryDays: number;
    reshowOnVersionChange: boolean;
    legalFooterText: string;
  };
  builder?: {
    provider: 'iubenda' | 'cookiebot' | 'cookieyes' | 'onetrust' | 'custom';
    providerConfig: {
      siteId?: string;
      cookiePolicyId?: string;
      scriptId?: string;
      headSnippet?: string;
      bodySnippet?: string;
      privacyPolicyUrl?: string;
      cookiePolicyUrl?: string;
    };
    reopenSelector: string;
  };
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Public (unauthenticated) consent config API — called from the public page */
export const consentConfigPublicApi = {
  get: async (): Promise<{ success: boolean; data?: ConsentConfigData }> => {
    return apiRequest<{ success: boolean; data?: ConsentConfigData }>('/consent-config/public');
  },
};

/** Admin (authenticated) consent config API */
export const consentConfigApi = {
  get: async (): Promise<{ success: boolean; data?: ConsentConfigData }> => {
    return apiRequest<{ success: boolean; data?: ConsentConfigData }>('/consent-config');
  },

  update: async (config: Omit<ConsentConfigData, 'createdAt' | 'updatedAt'>): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>('/consent-config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
};

// Utility API
export const utilityApi = {
  generatePassword: async (): Promise<{ password: string }> => {
    return apiRequest<{ password: string }>('/generate-password');
  },

  validatePassword: async (password: string): Promise<{ isStrong: boolean }> => {
    return apiRequest<{ isStrong: boolean }>('/validate-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  getHealth: async (): Promise<{ status: string; version: string; timestamp: string; uptime: number; node: string; demoMode: boolean }> => {
    return apiRequest<{ status: string; version: string; timestamp: string; uptime: number; node: string; demoMode: boolean }>('/health');
  },
};
