const API_BASE = '/api';

// --- Secure token storage (AES-GCM via Web Crypto) ---
const TOKEN_STORAGE_KEY = 'lynx-auth-token';
const TOKEN_IV_PREFIX = 'lynx-auth-iv-';
const DEVICE_SECRET_KEY = 'lynx-device-secret';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const getCryptoOrThrow = (): Crypto => {
  if (typeof crypto !== 'undefined' && crypto.subtle) return crypto as Crypto;
  throw new Error('Web Crypto API is not available');
};

const getOrCreateDeviceSecret = (): Uint8Array => {
  let existing = localStorage.getItem(DEVICE_SECRET_KEY);
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
  const ctB64 = localStorage.getItem(TOKEN_STORAGE_KEY);
  const ivB64 = localStorage.getItem(TOKEN_IV_PREFIX + TOKEN_STORAGE_KEY);
  if (!ctB64 || !ivB64) return null;
  // Synchronous callers expect a string; we cannot block on async here.
  // For simplicity, decrypt synchronously via microtask by caching the last token.
  // We'll maintain a small cache.
  const cached = (window as any).__lynxTokenCache as { iv: string; ct: string; val: string } | undefined;
  if (cached && cached.iv === ivB64 && cached.ct === ctB64) {
    return cached.val;
  }
  return null;
};

// Async variant for flows that can await (API calls)
const getAuthTokenAsync = async (): Promise<string | null> => {
  const cached = getAuthToken();
  if (cached) return cached;
  const ctB64 = localStorage.getItem(TOKEN_STORAGE_KEY);
  const ivB64 = localStorage.getItem(TOKEN_IV_PREFIX + TOKEN_STORAGE_KEY);
  if (!ctB64 || !ivB64) return null;
  const val = await decryptToken(ivB64, ctB64);
  if (val) {
    (window as any).__lynxTokenCache = { iv: ivB64, ct: ctB64, val };
  }
  return val;
};

// Set auth token (encrypt before storage) and cache plaintext in memory
const setAuthToken = (token: string): void => {
  encryptToken(token).then(({ ivB64, ctB64 }) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, ctB64);
    localStorage.setItem(TOKEN_IV_PREFIX + TOKEN_STORAGE_KEY, ivB64);
    (window as any).__lynxTokenCache = { iv: ivB64, ct: ctB64, val: token };
  }).catch(() => {
    // Fallback: store plaintext if encryption fails, but avoid crashing
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  });
};

// Remove auth token
const removeAuthToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_IV_PREFIX + TOKEN_STORAGE_KEY);
  delete (window as any).__lynxTokenCache;
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
  let url = `${API_BASE}${endpoint}`;
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

    const data = await response.json();

    if (!response.ok) {
      // If token is invalid or expired, clear it and signal to UI
      if (response.status === 401 || response.status === 403) {
        removeAuthToken();
        throw new Error('AUTH_EXPIRED');
      }
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data as T;
  } catch (error: any) {
    console.error(`API Request Error (${endpoint}):`, error);
    throw new Error(error.message || 'Failed to connect to the server');
  }
};

// Auth API
export const authApi = {
  checkSetupStatus: async (): Promise<{ isFirstTimeSetup: boolean }> => {
    return apiRequest<{ isFirstTimeSetup: boolean }>('/auth/setup-status');
  },

  setup: async (password: string): Promise<SetupResponse> => {
    return apiRequest<SetupResponse>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }).then((response) => {
      if (response.token) {
        setAuthToken(response.token);
      }
      return response;
    });
  },

  login: async (password: string): Promise<LoginResponse> => {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }).then((response) => {
      if (response.token) {
        setAuthToken(response.token);
      }
      return response;
    });
  },

  verify: async (): Promise<VerifyResponse> => {
    return apiRequest<VerifyResponse>('/auth/verify', { method: 'POST' });
  },

  logout: (): void => {
    removeAuthToken();
  },

  isAuthenticated: (): boolean => {
    return !!getAuthToken();
  },

  reset: async (): Promise<ApiResponse> => {
    return apiRequest<ApiResponse>('/auth/reset', { method: 'POST' });
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> => {
    return apiRequest<ChangePasswordResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then((response) => {
      if (response.token) {
        setAuthToken(response.token);
      }
      return response;
    });
  },
};

// Profile API
export const profileApi = {
  get: async (): Promise<ProfileResponse> => {
    return apiRequest<ProfileResponse>('/profile').then((resp) => {
      const showAvatar = typeof (resp as any).show_avatar !== 'undefined'
        ? ((resp as any).show_avatar !== 0)
        : (typeof (resp as any).showAvatar !== 'undefined' ? (resp as any).showAvatar : true);
      return { ...(resp as any), showAvatar } as ProfileResponse;
    });
  },

  update: async (profile: { name: string; bio: string; avatar: string; socialLinks: Record<string, string>; showAvatar?: boolean; nameFontSize?: string; bioFontSize?: string; tabTitle?: string; metaDescription?: string }): Promise<ApiResponse> => {
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
        meta_description: profile.metaDescription || undefined
      }),
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
      const resp = await fetch(`${API_BASE}/links/export`, {
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
};
