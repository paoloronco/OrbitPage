import express from 'express';
import https from 'https';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path, { dirname, join } from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { initializeDatabase, dbGet, dbAll, dbRun, withTransaction } from './database.js';
import {
  isFirstTimeSetup,
  setupInitialCredentials,
  authenticateUser,
  generateToken,
  generateTwoFactorChallenge,
  verifyTwoFactorChallenge,
  verifyToken,
  authenticateToken,
  isPasswordStrong,
  generateSecurePassword,
  requirePermission,
  requireAnyPermission,
  getPermissionsForRole,
} from './auth.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import multer from 'multer';
import { LinkSchema, LinksPayloadSchema } from './schemas/link.schema.js';
import { buildEmbedFrameDocument, buildEmbedFrameErrorDocument, EMBED_FRAME_CSP } from './embed-frame.js';
import { ConsentConfigBodySchema } from './schemas/consent.schema.js';
import { DEFAULT_MENU_CATALOG, parseMenuCatalog } from './schemas/menu.schema.js';
import {
  ChangePasswordBodySchema,
  CreateUserBodySchema,
  LoginBodySchema,
  ResetViaTokenBodySchema,
  SetupBodySchema,
  UpdateRoleBodySchema,
  UpdateUserPasswordBodySchema,
  TwoFactorCodeBodySchema,
  TwoFactorManageBodySchema,
  TwoFactorVerifyBodySchema,
} from './schemas/auth.schema.js';
import {
  UPLOAD_FILE_MODE,
  UploadQuotaExceededError,
  createUploadFilename,
  enforceUploadStorageQuota,
  getUploadStorageQuotaBytes,
  getVideoUploadLimitBytes,
} from './services/upload-policy.js';
import { assertUploadedMediaSignature } from './services/media-signature.js';
import {
  createApplicationBackup,
  restoreApplicationBackup,
} from './services/backup-service.js';
import { cleanupUnusedMedia, mediaCleanupGraceMs } from './services/media-cleanup.js';
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  verifySecondFactor,
} from './services/two-factor-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let APP_VERSION = '4.11.9';
try {
  const pkg = JSON.parse(fs.readFileSync(join(__dirname, 'package.json'), 'utf8'));
  APP_VERSION = pkg.version || APP_VERSION;
} catch { /* package.json not available; use the fallback */ }

const DEMO_MODE = String(process.env.DEMO_MODE || '').toLowerCase() === 'true' || process.env.DEMO_MODE === '1';
console.log('Demo mode:', DEMO_MODE, 'from env:', process.env.DEMO_MODE);
const DEMO_RESET_INTERVAL_MS = 5 * 60 * 1000;
const DEMO_RESET_TABLES = ['admin_users', 'profile_data', 'links', 'theme_config', 'menu_config', 'subpages_config', 'cookie_consent_config', 'text_files', 'sitemap_config'];

// DATA_DIR is set to /app/data in Docker (see Dockerfile ENV).
// When running locally without the env var, data lives next to server.js.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const uploadStorageQuotaBytes = getUploadStorageQuotaBytes(process.env);
const videoUploadLimitBytes = getVideoUploadLimitBytes(process.env);

const getZodErrorMessage = (error) =>
  error instanceof z.ZodError ? (error.issues[0]?.message || 'Invalid request body') : null;

const RESERVED_SUBPAGE_SLUGS = new Set(['admin', 'api', 'assets', 'cookies', 'dashboard', 'login', 'media', 'menu', 'orbitpage-runtime', 'privacy', 'robots.txt', 'sitemap.xml', 'support', 'terms', 'www']);
const SubpageSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  slug: z.string().min(1).max(48).regex(/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/)
    .refine((slug) => !RESERVED_SUBPAGE_SLUGS.has(slug), 'This page slug is reserved.'),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).default(''),
  links: z.array(LinkSchema).max(150).default([]),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
}).strict();
const SubpagesPayloadSchema = z.array(SubpageSchema).max(20).superRefine((pages, context) => {
  const seen = new Set();
  pages.forEach((page, index) => {
    if (seen.has(page.slug)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'slug'], message: 'Page slugs must be unique.' });
    seen.add(page.slug);
  });
});

function safeJsonParse(jsonString, defaultValue = {}) {
  try {
    if (typeof jsonString !== 'string') {
      return defaultValue;
    }
    const parsed = JSON.parse(jsonString);
    // Ensure the parsed value is an object and not an array or other type
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

const app = express();
const PORT = process.env.PORT || 3001;
const ENABLE_HTTPS = String(process.env.ENABLE_HTTPS || '').toLowerCase() === 'true' || process.env.ENABLE_HTTPS === '1';
const SSL_PORT = Number.parseInt(process.env.SSL_PORT || '', 10) || 8443;
const PUBLIC_SITE_URL = String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '').trim();
const PUBLIC_SITE_NAME = String(process.env.PUBLIC_SITE_NAME || 'OrbitPage').trim() || 'OrbitPage';
const ABOUT_PAGE_TITLE = 'OrbitPage | Self-hosted Public Page Manager';
const ABOUT_PAGE_DESCRIPTION = 'OrbitPage is an open-source, self-hosted public page manager for people, brands, venues, events, and teams that want one place for links, content, analytics, privacy controls, and backups.';
const ABOUT_PAGE_IMAGE_URL = 'https://raw.githubusercontent.com/paoloronco/OrbitPage/main/docs/screenshots/01-public-page.png';
const ABOUT_PAGE_IMAGE_ALT = 'Screenshot of an OrbitPage public page';
const ABOUT_PAGE_KEYWORDS = 'self-hosted public page, open-source landing page, Docker link page, privacy-friendly page manager, OrbitPage';
const SEO_INDEXING = !['0', 'false', 'no', 'off'].includes(
  String(process.env.SEO_INDEXING ?? 'true').trim().toLowerCase()
);
const normalizeBasePath = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
};
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || process.env.PUBLIC_BASE_PATH || '');
// In production (Docker), frontend and backend are same-origin, so use 'self'
// In development, use explicit localhost URL for CORS/CSP
const IS_PRODUCTION = !process.env.FRONTEND_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
// Ensure correct client IP detection when behind a proxy/load balancer
// This is important so express-rate-limit keys by the real client IP
app.set('trust proxy', 1);

app.use((req, res, next) => {
  req.orbitpageBasePath = '';
  if (!BASE_PATH) return next();

  if (req.url === BASE_PATH || req.url.startsWith(`${BASE_PATH}/`) || req.url.startsWith(`${BASE_PATH}?`)) {
    req.orbitpageBasePath = BASE_PATH;
    const strippedUrl = req.url.slice(BASE_PATH.length);
    req.url = !strippedUrl ? '/' : strippedUrl.startsWith('?') ? `/${strippedUrl}` : strippedUrl;
  }

  next();
});

const USERCENTRICS_CSP_SOURCES = [
  "https://policygenerator.usercentrics.eu",
  "https://*.usercentrics.eu",
  "https://*.cmp.usercentrics.eu",
];

const IUBENDA_CSP_SOURCES = [
  "https://*.iubenda.com",
];

const EXTERNAL_CMP_CDN_SOURCES = [
  "https://cdn-cookieyes.com",
  "https://cdn.cookielaw.org",
];

const EXTERNAL_CMP_CONNECT_SOURCES = [
  ...EXTERNAL_CMP_CDN_SOURCES,
  "https://cookie-cdn.cookiepro.com",
  "https://privacyportal.onetrust.com",
  "https://privacyportal-cdn.onetrust.com",
  "https://geolocation.onetrust.com",
];

const LEGAL_EMBED_CSP_SOURCES = [
  ...USERCENTRICS_CSP_SOURCES,
  ...IUBENDA_CSP_SOURCES,
];

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Log the origin for debugging
    console.log(`CORS request from origin: ${origin || 'no-origin'}, IS_PRODUCTION: ${IS_PRODUCTION}`);
    
    // Allow requests with no origin (like mobile apps, Postman, or direct server requests)
    if (!origin) return callback(null, true);
    
    // In production (Docker), allow same-origin and common development origins
    if (IS_PRODUCTION) {
      // Allow localhost origins for development/debugging
      if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
        console.log(`CORS: Allowing localhost origin in production: ${origin}`);
        return callback(null, true);
      }
      // Allow the request origin (handles reverse proxy scenarios)
      console.log(`CORS: Allowing request origin in production: ${origin}`);
      return callback(null, origin);
    }
    
    // In development, only allow the configured FRONTEND_URL
    if (origin === FRONTEND_URL) {
      console.log(`CORS: Allowing configured FRONTEND_URL in development: ${origin}`);
      return callback(null, true);
    }
    
    console.log(`CORS: Rejecting origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(helmet({
  contentSecurityPolicy: {
    // useDefaults: false prevents Helmet from merging in its own defaults on top of our
    // directives. Without this, Helmet always adds `upgrade-insecure-requests` (which
    // breaks assets on plain-HTTP deployments) and other defaults we don't want merged.
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      // Security directives from Helmet defaults — kept explicit so they stay active
      // now that useDefaults:false disables auto-merging.
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      scriptSrcAttr: ["'none'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'", "'unsafe-eval'",
        "https://www.googletagmanager.com", "https://*.googletagmanager.com",
        "https://www.google-analytics.com", "https://*.google-analytics.com",
        "https://static.cloudflareinsights.com",
        // Cookiebot: uc.js entry-point (consent.cookiebot.com)
        // and CDN assets e.g. configuration.js (consentcdn.cookiebot.com)
        "https://consent.cookiebot.com",
        "https://consentcdn.cookiebot.com",
        ...EXTERNAL_CMP_CDN_SOURCES,
        ...LEGAL_EMBED_CSP_SOURCES,
      ],
      styleSrc: [
        "'self'", "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://tagassistant.google.com",
        ...EXTERNAL_CMP_CDN_SOURCES,
        ...LEGAL_EMBED_CSP_SOURCES,
      ],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: IS_PRODUCTION
        ? [
            "'self'", "http://localhost:*", "https://localhost:*",
            "https://www.google-analytics.com", "https://*.google-analytics.com",
            "https://analytics.google.com", "https://*.analytics.google.com",
            "https://www.googletagmanager.com", "https://*.googletagmanager.com",
            "https://stats.g.doubleclick.net", "https://cloudflareinsights.com",
            // Cookiebot: consent record API (consent.cookiebot.com)
            // and CDN config/settings fetches e.g. settings.json (consentcdn.cookiebot.com)
            "https://consent.cookiebot.com",
            "https://consentcdn.cookiebot.com",
            ...EXTERNAL_CMP_CONNECT_SOURCES,
            ...LEGAL_EMBED_CSP_SOURCES,
          ]
        : [
            "'self'", FRONTEND_URL,
            "https://www.google-analytics.com", "https://*.google-analytics.com",
            "https://analytics.google.com", "https://*.analytics.google.com",
            "https://www.googletagmanager.com", "https://*.googletagmanager.com",
            "https://stats.g.doubleclick.net", "https://cloudflareinsights.com",
            // Cookiebot: consent record API (consent.cookiebot.com)
            // and CDN config/settings fetches e.g. settings.json (consentcdn.cookiebot.com)
            "https://consent.cookiebot.com",
            "https://consentcdn.cookiebot.com",
            ...EXTERNAL_CMP_CONNECT_SOURCES,
            ...LEGAL_EMBED_CSP_SOURCES,
          ],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: [
        "'self'",
        "https://www.youtube-nocookie.com",
        "https://open.spotify.com",
        "https://calendly.com",
        "https://www.calendly.com",
        "https://www.google.com",
        "https://maps.google.com",
        // Cookiebot: iframe that renders the consent dialog UI
        "https://consentcdn.cookiebot.com",
        ...LEGAL_EMBED_CSP_SOURCES,
      ]
      // NOTE: upgrade-insecure-requests is intentionally absent here.
      // It is added dynamically (see middleware below) only when the connection
      // is confirmed HTTPS — sending it on HTTP would cause the browser to upgrade
      // every subresource request to HTTPS on the same port, breaking all assets.
    },
    reportOnly: false
  },
  // HSTS is managed by the per-request middleware below so it is only sent when
  // the connection is actually HTTPS (direct TLS or behind an HTTPS reverse proxy).
  // Sending HSTS on plain HTTP is a no-op at best and confusing at worst.
  hsts: false,
  crossOriginEmbedderPolicy: false
}));

// HTTPS-only security headers.
// req.protocol is already normalised by Express: with `trust proxy: 1` it reads
// X-Forwarded-Proto from the nearest trusted proxy, so Cloud Run / Nginx setups
// that terminate TLS upstream are handled correctly.
app.use((req, res, next) => {
  if (req.protocol === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Tell browsers to upgrade HTTP subresource URLs to HTTPS — safe only when the
    // page itself is served over HTTPS; would break assets on plain-HTTP origins.
    const csp = res.getHeader('content-security-policy');
    if (typeof csp === 'string' && !csp.includes('upgrade-insecure-requests')) {
      res.setHeader('content-security-policy', `${csp}; upgrade-insecure-requests`);
    }
  }
  next();
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/dashboard') || req.path === '/health') {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  next();
});
app.use('/api/admin/restore', express.json({ limit: '300mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// Serve static files with proper path resolution
const distPath = join(__dirname, '../dist');
const indexHtmlPath = join(distPath, 'index.html');
const uploadsPath = join(DATA_DIR, 'uploads');

console.log('Serving static files from:', distPath);
console.log('Serving uploads from:', uploadsPath);

// Ensure uploads directory exists
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('Created uploads directory at:', uploadsPath);
}

const normalizePolicyUrl = (value, fieldName) => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${fieldName} must be a valid URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${fieldName} must start with http:// or https://.`);
  }

  return parsed.toString();
};

const IUBENDA_LOADER_SNIPPET = `<script type="text/javascript">
  (function (w, d) {
    var loader = function () {
      var s = d.createElement("script"),
          tag = d.getElementsByTagName("script")[0];
      s.src = "https://cdn.iubenda.com/iubenda.js";
      tag.parentNode.insertBefore(s, tag);
    };
    if (w.addEventListener) {
      w.addEventListener("load", loader, false);
    } else if (w.attachEvent) {
      w.attachEvent("onload", loader);
    } else {
      w.onload = loader;
    }
  })(window, document);
</script>`;

const DEMO_PRIVACY_POLICY_EMBED = `<a href="https://www.iubenda.com/privacy-policy/30364665" class="iubenda-white iubenda-noiframe iubenda-embed" title="Privacy Policy">Privacy Policy</a>
${IUBENDA_LOADER_SNIPPET}`;

const DEMO_COOKIE_POLICY_EMBED = `<a href="https://www.iubenda.com/privacy-policy/30364665/cookie-policy" class="iubenda-white iubenda-noiframe iubenda-embed" title="Cookie Policy">Cookie Policy</a>
${IUBENDA_LOADER_SNIPPET}`;

const DEMO_CMP_SCRIPT = '<script type="text/javascript" src="https://embeds.iubenda.com/widgets/1b44c148-fd77-4997-9204-b5bcfbabfe52.js"></script>';

const DEMO_LEGAL_URLS = {
  privacyPolicyUrl: '/privacy',
  cookiePolicyUrl: '/cookies',
};

const getProfileLegalUrls = async () => {
  if (DEMO_MODE) return DEMO_LEGAL_URLS;

  const profile = await dbGet(
    'SELECT privacy_policy_url, cookie_policy_url FROM profile_data ORDER BY id DESC LIMIT 1'
  );

  return {
    privacyPolicyUrl: profile?.privacy_policy_url?.trim() || '',
    cookiePolicyUrl: profile?.cookie_policy_url?.trim() || '',
  };
};

const applyProfileLegalUrlsToConsentConfig = (config, legalUrls) => {
  if (!config || typeof config !== 'object') return config;

  const hasProfileLegalUrls = Boolean(legalUrls.privacyPolicyUrl || legalUrls.cookiePolicyUrl);
  const privacyMode = config.legalPolicies?.privacyPolicy?.mode ||
    (legalUrls.privacyPolicyUrl === '/privacy' ? 'hosted' : 'external');
  const cookieMode = config.legalPolicies?.cookiePolicy?.mode ||
    (legalUrls.cookiePolicyUrl === '/cookies' ? 'hosted' : 'external');
  const legalPolicies = {
    showFooterLinks: Boolean(config.legalPolicies?.showFooterLinks ?? hasProfileLegalUrls),
    privacyPolicy: {
      mode: privacyMode,
      hostedText: config.legalPolicies?.privacyPolicy?.hostedText || '',
      hostedFileName: config.legalPolicies?.privacyPolicy?.hostedFileName || '',
      embeddedCode: config.legalPolicies?.privacyPolicy?.embeddedCode || '',
      externalUrl: legalUrls.privacyPolicyUrl || '',
    },
    cookiePolicy: {
      mode: cookieMode,
      hostedText: config.legalPolicies?.cookiePolicy?.hostedText || '',
      hostedFileName: config.legalPolicies?.cookiePolicy?.hostedFileName || '',
      embeddedCode: config.legalPolicies?.cookiePolicy?.embeddedCode || '',
      externalUrl: legalUrls.cookiePolicyUrl || '',
    },
  };

  const hardcoded = config.hardcoded
    ? {
        ...config.hardcoded,
        urls: {
          privacyPolicy: legalUrls.privacyPolicyUrl || '',
          cookiePolicy: legalUrls.cookiePolicyUrl || '',
        },
      }
    : config.hardcoded;

  const builder = config.builder
    ? {
        ...config.builder,
        providerConfig: {
          ...(config.builder.providerConfig || {}),
          privacyPolicyUrl: '',
          cookiePolicyUrl: '',
        },
      }
    : config.builder;

  return { ...config, legalPolicies, hardcoded, builder };
};

const stripDuplicateLegalUrlsFromConsentConfig = ({ legalPolicies, hardcoded, builder }) => ({
  legalPolicies: legalPolicies ? {
    ...legalPolicies,
    privacyPolicy: {
      ...(legalPolicies.privacyPolicy || {}),
      externalUrl: '',
    },
    cookiePolicy: {
      ...(legalPolicies.cookiePolicy || {}),
      externalUrl: '',
    },
  } : undefined,
  hardcoded: {
    ...hardcoded,
    urls: { privacyPolicy: '', cookiePolicy: '' },
  },
  builder: {
    ...builder,
    providerConfig: {
      ...(builder?.providerConfig || {}),
      privacyPolicyUrl: '',
      cookiePolicyUrl: '',
    },
  },
});

const setNoStoreHeaders = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
};

const normalizeAvatar = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return '/assets/profile-avatar.jpg';
  if (avatar.startsWith('data:') || avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  if (avatar.includes('/src/assets/profile-avatar')) return '/assets/profile-avatar.jpg';

  try {
    avatar = String(avatar).replace(/\\/g, '/');
    avatar = avatar.replace(/^\/+/, '/');
    avatar = avatar.replace(/(\/uploads)+\//i, '/uploads/');
  } catch {
    // Continue with the original value if normalization fails.
  }

  if (avatar.startsWith('/public/')) return avatar.replace('/public/', '/');
  if (!avatar.startsWith('/')) return `/${avatar}`;
  return avatar;
};

const getPublicProfilePayload = async () => {
  const profile = await dbGet('SELECT * FROM profile_data ORDER BY id DESC LIMIT 1');
  const demoLegalUrls = DEMO_MODE ? DEMO_LEGAL_URLS : {};

  if (!profile) {
    return {
      name: '',
      bio: '',
      avatar: '/assets/profile-avatar.jpg',
      social_links: {},
      show_avatar: 0,
      name_font_size: '2rem',
      bio_font_size: '14px',
      appearance: {},
      tab_title: undefined,
      meta_description: undefined,
      footer_text: undefined,
      favicon: undefined,
      google_analytics_id: undefined,
      privacy_policy_url: demoLegalUrls.privacyPolicyUrl,
      cookie_policy_url: demoLegalUrls.cookiePolicyUrl,
    };
  }

  return {
    name: profile.name || '',
    bio: profile.bio || '',
    avatar: normalizeAvatar(profile.avatar) || '/assets/profile-avatar.jpg',
    social_links: safeJsonParse(profile.social_links, {}),
    show_avatar: profile.show_avatar === 0 ? 0 : 1,
    name_font_size: profile.name_font_size || '2rem',
    bio_font_size: profile.bio_font_size || '14px',
    appearance: safeJsonParse(profile.appearance, {}),
    tab_title: profile.tab_title || undefined,
    meta_description: profile.meta_description || undefined,
    footer_text: profile.footer_text || undefined,
    favicon: profile.favicon || undefined,
    google_analytics_id: profile.google_analytics_id || undefined,
    privacy_policy_url: demoLegalUrls.privacyPolicyUrl || profile.privacy_policy_url || undefined,
    cookie_policy_url: demoLegalUrls.cookiePolicyUrl || profile.cookie_policy_url || undefined,
  };
};

const LINK_STATUSES = new Set(['draft', 'live', 'expired']);

const normalizeLinkStatus = (status) => {
  const value = String(status || 'live').trim().toLowerCase();
  return LINK_STATUSES.has(value) ? value : 'live';
};

const parseTimeToMinutes = (value) => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const getDatePartsForTimezone = (date, timezone) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || process.env.TZ || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(date).map((part) => [part.type, part.value])
    );
    const hour = Number(parts.hour === '24' ? '00' : parts.hour);
    const minute = Number(parts.minute);
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: hour * 60 + minute,
    };
  } catch {
    return {
      date: date.toISOString().slice(0, 10),
      minutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
    };
  }
};

const isLinkPubliclyVisible = (link, now = new Date()) => {
  if (link.is_active === 0) return false;

  const status = normalizeLinkStatus(link.status);
  if (status !== 'live') return false;

  const { date: currentDate, minutes: currentMinutes } = getDatePartsForTimezone(
    now,
    link.timezone || process.env.TZ || 'UTC'
  );
  const startDate = link.start_date || null;
  const endDate = link.end_date || null;
  const startMinutes = parseTimeToMinutes(link.start_time);
  const endMinutes = parseTimeToMinutes(link.end_time);

  if (startDate && startDate > currentDate) return false;
  if (endDate && endDate < currentDate) return false;
  if ((!startDate || startDate <= currentDate) && startMinutes != null && startMinutes > currentMinutes) return false;
  if ((!endDate || endDate >= currentDate) && endMinutes != null && endMinutes < currentMinutes) return false;

  return true;
};

const formatLinkPayload = (link) => {
  const icon = link.icon && (link.icon.startsWith('data:image/') || link.icon.startsWith('blob:'))
    ? link.icon
    : link.icon || null;

  return {
    id: link.id,
    title: link.title,
    description: link.description || '',
    url: link.url || '',
    hideUrl: link.hide_url === 1,
    icon,
    iconType: link.icon_type || (icon ? 'image' : undefined),
    content: link.content || null,
    textItems: link.text_items ? (() => { try { return JSON.parse(link.text_items); } catch { return null; } })() : null,
    type: link.type || 'link',
    backgroundColor: link.background_color || undefined,
    titleFontFamily: link.title_font_family || undefined,
    descriptionFontFamily: link.description_font_family || undefined,
    alignment: link.text_alignment || undefined,
    titleFontSize: link.title_font_size || undefined,
    descriptionFontSize: link.description_font_size || undefined,
    textColor: link.text_color || undefined,
    order: link.sort_order || 0,
    size: link.size || 'medium',
    isActive: link.is_active !== 0,
    clickCount: link.click_count || 0,
    ctaAction: link.cta_action || null,
    ctaClicks: link.cta_click_count || 0,
    status: normalizeLinkStatus(link.status),
    campaignName: link.campaign_name || null,
    startDate: link.start_date || null,
    startTime: link.start_time || null,
    endDate: link.end_date || null,
    endTime: link.end_time || null,
    timezone: link.timezone || null,
    availability: link.availability === 'unavailable' ? 'unavailable' : 'available',
    coverImage: link.cover_image || undefined,
    coverImageAlt: link.cover_image_alt || undefined,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
  };
};

const getPublicLinksPayload = async () => {
  const links = await dbAll('SELECT * FROM links WHERE is_active = 1 ORDER BY sort_order');

  return links.filter((link) => isLinkPubliclyVisible(link)).map(formatLinkPayload);
};

const DEFAULT_THEME_PAYLOAD = {
  primary: '#2563eb',
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  card: '#ffffff',
  backgroundGradient: {
    from: '#ffffff',
    to: '#f8fafc',
    direction: '135deg',
  },
  cardGradient: {
    from: '#ffffff',
    to: '#f8fafc',
    direction: '135deg',
  },
};

const getPublicThemePayload = async () => {
  const theme = await dbGet('SELECT * FROM theme_config ORDER BY id DESC LIMIT 1');

  if (!theme) {
    return { ...DEFAULT_THEME_PAYLOAD };
  }

  if (theme.full_config) {
    try {
      return JSON.parse(theme.full_config);
    } catch {
      // Fall back to the compact theme fields below.
    }
  }

  return {
    primary: theme.primary_color,
    background: theme.background_color,
    foreground: theme.text_color,
  };
};

const PUBLIC_SPA_ROUTES = new Set(['/', '/privacy', '/cookies']);
const ADMIN_SPA_SECTIONS = new Set(['profile', 'links', 'theme', 'menu', 'qr', 'access', 'backup', 'analytics', 'privacy', 'txt', 'sitemap']);
const isAdminSpaRoute = (pathName) => {
  const segments = String(pathName || '').split('/').filter(Boolean);
  if (segments.length === 1 && (segments[0] === 'admin' || segments[0] === 'dashboard')) return true;
  return segments.length === 2
    && (segments[0] === 'admin' || segments[0] === 'dashboard')
    && ADMIN_SPA_SECTIONS.has(segments[1]);
};
if (DEMO_MODE) {
  PUBLIC_SPA_ROUTES.add('/about');
}

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ');

const compactText = (value = '', maxLength = 160) => {
  const compacted = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength - 1).trim()}...`;
};

const safeJsonForHtml = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const normalizeOrigin = (value) => {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
};

const getRequestOrigin = (req) => {
  const configuredOrigin = normalizeOrigin(PUBLIC_SITE_URL);
  if (configuredOrigin) return configuredOrigin;

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get('host') || `localhost:${PORT}`;
  return `${protocol}://${host}`.replace(/\/$/, '');
};

const getActiveBasePath = (req) => req.orbitpageBasePath || '';

const withRequestBasePath = (req, pathName = '/') => {
  const normalizedPath = pathName.startsWith('/') ? pathName : `/${pathName}`;
  return `${getActiveBasePath(req)}${normalizedPath}` || '/';
};

const toAbsoluteHttpUrl = (value, origin) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;
  try {
    const url = new URL(trimmed, origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

const canonicalPathForRequest = (req) => {
  const pathOnly = req.path || '/';
  if (pathOnly === '/privacy' || pathOnly === '/cookies' || isAdminSpaRoute(pathOnly) || (DEMO_MODE && pathOnly === '/about')) return pathOnly;
  return '/';
};

const getPageKind = (pathName) => {
  if (pathName === '/privacy') return 'privacy';
  if (pathName === '/cookies') return 'cookies';
  if (isAdminSpaRoute(pathName)) return 'admin';
  if (DEMO_MODE && pathName === '/about') return 'about';
  return 'home';
};

const getSocialUrls = (profile, origin) => Object.values(profile?.social_links || {})
  .map((url) => toAbsoluteHttpUrl(url, origin))
  .filter(Boolean);

const getSeoTitle = (profile, pageKind) => {
  if (pageKind === 'privacy') return `Privacy Policy | ${profile?.name || PUBLIC_SITE_NAME}`;
  if (pageKind === 'cookies') return `Cookie Policy | ${profile?.name || PUBLIC_SITE_NAME}`;
  if (pageKind === 'admin') return `Admin | ${PUBLIC_SITE_NAME}`;
  if (pageKind === 'about') return ABOUT_PAGE_TITLE;
  return profile?.tab_title || profile?.name || PUBLIC_SITE_NAME;
};

const getSeoDescription = (profile, pageKind) => {
  if (pageKind === 'privacy') return 'Privacy information for this OrbitPage instance.';
  if (pageKind === 'cookies') return 'Cookie policy information for this OrbitPage instance.';
  if (pageKind === 'admin') return 'Private OrbitPage administration area.';
  if (pageKind === 'about') return ABOUT_PAGE_DESCRIPTION;
  return compactText(
    profile?.meta_description ||
    profile?.bio ||
    'A public page powered by the open-source OrbitPage manager.',
    160
  );
};

const getSeoImageUrl = (profile, pageKind, origin) => {
  if (pageKind === 'about') return ABOUT_PAGE_IMAGE_URL;
  return toAbsoluteHttpUrl(profile?.avatar, origin);
};

const getSeoKeywords = (pageKind) => {
  if (pageKind === 'about') return ABOUT_PAGE_KEYWORDS;
  return '';
};

const getSeoImageAlt = (profile, pageKind) => {
  if (pageKind === 'about') return ABOUT_PAGE_IMAGE_ALT;
  return profile?.name ? `${profile.name} page image` : '';
};

const buildStructuredData = ({ profile, links, origin, canonicalUrl, pageKind }) => {
  const pageName = getSeoTitle(profile, pageKind);
  const description = getSeoDescription(profile, pageKind);
  const sameAs = getSocialUrls(profile, origin);
  const image = getSeoImageUrl(profile, pageKind, origin);

  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      url: `${origin}/`,
      name: profile?.name || PUBLIC_SITE_NAME,
      description,
    },
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: pageName,
      description,
      isPartOf: { '@id': `${origin}/#website` },
    },
  ];

  if (pageKind === 'about') {
    graph[1] = {
      ...graph[1],
      '@type': 'AboutPage',
      primaryImageOfPage: image ? { '@id': `${canonicalUrl}#primaryimage` } : undefined,
      about: { '@id': `${origin}/#software` },
    };

    if (image) {
      graph.push({
        '@type': 'ImageObject',
        '@id': `${canonicalUrl}#primaryimage`,
        url: image,
        contentUrl: image,
        caption: ABOUT_PAGE_IMAGE_ALT,
      });
    }

    graph.push({
      '@type': 'SoftwareApplication',
      '@id': `${origin}/#software`,
      name: 'OrbitPage',
      description,
      applicationCategory: 'WebApplication',
      operatingSystem: 'Docker, Linux, Windows, macOS',
      softwareVersion: APP_VERSION,
      codeRepository: 'https://github.com/paoloronco/OrbitPage',
      downloadUrl: 'https://hub.docker.com/r/paueron/orbitpage',
      license: 'https://github.com/paoloronco/OrbitPage/blob/main/LICENSE.txt',
      image: image || undefined,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    });

    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Demo',
          item: new URL(withBasePathForStructuredData('/', canonicalUrl), canonicalUrl).toString(),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'About OrbitPage',
          item: canonicalUrl,
        },
      ],
    });
  }

  if (pageKind === 'home' && profile?.name) {
    graph.push({
      '@type': 'Person',
      '@id': `${origin}/#person`,
      name: profile.name,
      description: compactText(profile.bio || '', 240),
      image: image || undefined,
      sameAs: sameAs.length ? sameAs : undefined,
      mainEntityOfPage: { '@id': `${canonicalUrl}#webpage` },
    });
  }

  const linkItems = (links || [])
    .filter((link) => link?.type === 'link' && link?.title && toAbsoluteHttpUrl(link.url, origin))
    .slice(0, 50)
    .map((link) => ({
      '@type': 'WebPage',
      name: compactText(link.title, 120),
      description: compactText(link.description || '', 180) || undefined,
      url: toAbsoluteHttpUrl(link.url, origin),
    }));

  if (pageKind === 'home' && linkItems.length) {
    graph.push({
      '@type': 'ItemList',
      '@id': `${origin}/#links`,
      itemListElement: linkItems.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item,
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
};

const withBasePathForStructuredData = (targetPath, canonicalUrl) => {
  const current = new URL(canonicalUrl);
  const pathPrefix = current.pathname.endsWith('/about')
    ? current.pathname.slice(0, -'/about'.length)
    : '';
  const normalizedTarget = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  return `${pathPrefix}${normalizedTarget}`.replace(/\/{2,}/g, '/') || '/';
};

const renderSeoTags = ({ title, description, canonicalUrl, imageUrl, imageAlt, keywords, robots, structuredData, basePath }) => {
  const cardType = imageUrl ? 'summary_large_image' : 'summary';
  return [
    `<script>window.__ORBITPAGE_BASE_PATH__=${safeJsonForHtml(basePath || '')};</script>`,
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${escapeHtml(robots)}" />`,
    keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : '',
    `<meta name="application-name" content="${escapeHtml(PUBLIC_SITE_NAME)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(PUBLIC_SITE_NAME)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : '',
    imageUrl ? `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />` : '',
    imageUrl ? `<meta property="og:image:width" content="1919" />` : '',
    imageUrl ? `<meta property="og:image:height" content="1019" />` : '',
    imageUrl && imageAlt ? `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />` : '',
    `<meta name="twitter:card" content="${cardType}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : '',
    imageUrl && imageAlt ? `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />` : '',
    structuredData ? `<script type="application/ld+json" id="orbitpage-structured-data">${safeJsonForHtml(structuredData)}</script>` : '',
  ].filter(Boolean).join('\n    ');
};

const isTagBoundary = (char) => !char || char === '>' || char === '/' || char <= ' ';

const findNextSeoTag = (html, fromIndex = 0) => {
  const lowerHtml = html.toLowerCase();
  const tagNames = ['title', 'meta', 'link', 'script'];
  let next = null;

  for (const tagName of tagNames) {
    let index = lowerHtml.indexOf(`<${tagName}`, fromIndex);
    while (index !== -1 && !isTagBoundary(lowerHtml[index + tagName.length + 1])) {
      index = lowerHtml.indexOf(`<${tagName}`, index + 1);
    }
    if (index !== -1 && (!next || index < next.index)) {
      next = { tagName, index };
    }
  }

  return next;
};

const readTagAttributes = (openingTag) => {
  const attributes = {};
  let index = openingTag.indexOf(' ');
  if (index === -1) return attributes;

  while (index < openingTag.length) {
    while (index < openingTag.length && openingTag[index] <= ' ') index += 1;
    if (index >= openingTag.length || openingTag[index] === '>' || openingTag[index] === '/') break;

    const nameStart = index;
    while (index < openingTag.length && openingTag[index] > ' ' && openingTag[index] !== '=' && openingTag[index] !== '>' && openingTag[index] !== '/') {
      index += 1;
    }
    const name = openingTag.slice(nameStart, index).toLowerCase();
    while (index < openingTag.length && openingTag[index] <= ' ') index += 1;

    let value = '';
    if (openingTag[index] === '=') {
      index += 1;
      while (index < openingTag.length && openingTag[index] <= ' ') index += 1;
      const quote = openingTag[index] === '"' || openingTag[index] === "'" ? openingTag[index] : '';
      if (quote) {
        index += 1;
        const valueStart = index;
        while (index < openingTag.length && openingTag[index] !== quote) index += 1;
        value = openingTag.slice(valueStart, index);
        if (openingTag[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (index < openingTag.length && openingTag[index] > ' ' && openingTag[index] !== '>' && openingTag[index] !== '/') index += 1;
        value = openingTag.slice(valueStart, index);
      }
    }

    if (name) attributes[name] = value;
  }

  return attributes;
};

const shouldStripOpeningTag = (tagName, openingTag) => {
  if (tagName === 'title') return true;

  const attributes = readTagAttributes(openingTag);
  if (tagName === 'script') {
    return attributes.type?.toLowerCase() === 'application/ld+json';
  }
  if (tagName === 'link') {
    const rel = attributes.rel?.toLowerCase();
    return rel === 'canonical' || rel === 'alternate';
  }
  if (tagName === 'meta') {
    const key = (attributes.name || attributes.property || '').toLowerCase();
    return key === 'description' || key === 'robots' || key.startsWith('twitter:') || key.startsWith('og:');
  }

  return false;
};

const stripStaticSeoTags = (html) => {
  let nextHtml = String(html);
  let tag = findNextSeoTag(nextHtml);

  while (tag) {
    const lowerHtml = nextHtml.toLowerCase();
    const openingEnd = lowerHtml.indexOf('>', tag.index);
    if (openingEnd === -1) break;

    const openingTag = nextHtml.slice(tag.index, openingEnd + 1);
    if (!shouldStripOpeningTag(tag.tagName, openingTag)) {
      tag = findNextSeoTag(nextHtml, openingEnd + 1);
      continue;
    }

    let removeEnd = openingEnd + 1;
    if (tag.tagName === 'title' || tag.tagName === 'script') {
      const closing = `</${tag.tagName}>`;
      const closingStart = lowerHtml.indexOf(closing, openingEnd + 1);
      if (closingStart === -1) {
        tag = findNextSeoTag(nextHtml, openingEnd + 1);
        continue;
      }
      removeEnd = closingStart + closing.length;
    }

    while (removeEnd < nextHtml.length && nextHtml[removeEnd] <= ' ') removeEnd += 1;
    nextHtml = `${nextHtml.slice(0, tag.index)}${nextHtml.slice(removeEnd)}`;
    tag = findNextSeoTag(nextHtml);
  }

  return nextHtml;
};

const rewriteViteAssetUrls = (html, req) => {
  const assetBase = withRequestBasePath(req, '/assets/');
  const brandBase = withRequestBasePath(req, '/brand/');
  return html
    .replace(/\b(src|href)=["'](?:\.\/|\/)?assets\//g, (_match, attr) => `${attr}="${assetBase}`)
    .replace(/\b(src|href)=["'](?:\.\/|\/)?brand\//g, (_match, attr) => `${attr}="${brandBase}`)
    .replace(/\b(src|href)=["'](?:\.\/|\/)?favicon\.ico["']/g, (_match, attr) => `${attr}="${withRequestBasePath(req, '/favicon.ico')}"`)
    .replace(/\b(src|href)=["'](?:\.\/|\/)?placeholder\.svg["']/g, (_match, attr) => `${attr}="${withRequestBasePath(req, '/placeholder.svg')}"`);
};

const buildNoScriptPublicContent = (profile, links, origin) => {
  const visibleLinks = (links || [])
    .filter((link) => link?.type === 'link' && link?.title && toAbsoluteHttpUrl(link.url, origin))
    .slice(0, 100);

  const title = profile?.name || PUBLIC_SITE_NAME;
  const bio = compactText(profile?.bio || '', 500);
  const items = visibleLinks.map((link) => {
    const href = toAbsoluteHttpUrl(link.url, origin);
    const description = compactText(link.description || '', 220);
    return `<li><a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(link.title)}</a>${description ? `<p>${escapeHtml(description)}</p>` : ''}</li>`;
  }).join('');

  return `<noscript><main><h1>${escapeHtml(title)}</h1>${bio ? `<p>${escapeHtml(bio)}</p>` : ''}${items ? `<ul>${items}</ul>` : ''}</main></noscript>`;
};

const injectSeoIntoHtml = (html, { seoTags, noScriptContent }) => {
  let nextHtml = stripStaticSeoTags(html);
  nextHtml = nextHtml.replace('</head>', `    ${seoTags}\n  </head>`);
  if (noScriptContent) {
    nextHtml = nextHtml.replace('<div id="root"></div>', `<div id="root"></div>\n    ${noScriptContent}`);
  }
  return nextHtml;
};

const buildSeoContext = async (req, { statusCode = 200 } = {}) => {
  const origin = getRequestOrigin(req);
  let pathName = canonicalPathForRequest(req);
  const pageKind = getPageKind(pathName);
  const [profile, links] = pageKind === 'admin'
    ? [{ name: PUBLIC_SITE_NAME, social_links: {} }, []]
    : pageKind === 'about'
      ? [{ name: 'OrbitPage', social_links: {} }, []]
      : await Promise.all([getPublicProfilePayload(), getPublicLinksPayload()]);
  const [setupRequired, pageSlug] = pageKind === 'home'
    ? await Promise.all([isFirstTimeSetup(), getInstancePageSlug()])
    : [false, null];
  if (pageKind === 'home' && pageSlug) pathName = `/${pageSlug}`;
  const canonicalUrl = new URL(withRequestBasePath(req, pathName), origin).toString();

  const title = setupRequired ? `Page under construction | ${PUBLIC_SITE_NAME}` : getSeoTitle(profile, pageKind);
  const description = setupRequired
    ? 'This self-hosted OrbitPage installation is ready and waiting for its owner to complete the initial setup.'
    : getSeoDescription(profile, pageKind);
  const imageUrl = setupRequired ? null : getSeoImageUrl(profile, pageKind, origin);
  const imageAlt = getSeoImageAlt(profile, pageKind);
  const keywords = getSeoKeywords(pageKind);
  const shouldIndex = SEO_INDEXING && statusCode < 400 && pageKind !== 'admin' && !setupRequired;
  const robots = shouldIndex ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive';
  const structuredData = setupRequired ? null : buildStructuredData({ profile, links, origin, canonicalUrl, pageKind });
  const setupNoScript = '<noscript><main><h1>This page is under construction.</h1><p>Welcome to OrbitPage. Complete the private workspace setup to publish this page.</p></main></noscript>';

  return {
    seoTags: renderSeoTags({ title, description, canonicalUrl, imageUrl, imageAlt, keywords, robots, structuredData, basePath: BASE_PATH }),
    noScriptContent: setupRequired ? setupNoScript : pageKind === 'home' ? buildNoScriptPublicContent(profile, links, origin) : '',
    robots,
  };
};

const serveSpaIndex = async (req, res, { statusCode = 200 } = {}) => {
  try {
    let html = await fs.promises.readFile(indexHtmlPath, 'utf8');
    html = rewriteViteAssetUrls(html, req);
    const seo = await buildSeoContext(req, { statusCode });
    html = injectSeoIntoHtml(html, seo);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    if (seo.robots.startsWith('noindex')) {
      res.set('X-Robots-Tag', seo.robots);
    }
    res.status(statusCode).type('html').send(html);
  } catch (error) {
    console.error('Failed to serve SPA index:', error);
    res.status(statusCode).sendFile(indexHtmlPath);
  }
};

// Rate limit for serving SPA index.html (to mitigate file system abuse / DoS)
const spaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: "Too many requests, please try again later." },
});

const TEXT_FILE_DEFINITIONS = [
  {
    key: 'robots',
    path: '/robots.txt',
    label: 'robots.txt',
    description: 'Crawler access rules and sitemap discovery.',
  },
  {
    key: 'llms',
    path: '/llms.txt',
    aliases: ['/llm.txt'],
    label: 'llms.txt',
    description: 'LLM-readable project overview and canonical resources.',
  },
  {
    key: 'humans',
    path: '/humans.txt',
    label: 'humans.txt',
    description: 'Human-readable credits, tech stack, and repository links.',
  },
  {
    key: 'security',
    path: '/.well-known/security.txt',
    aliases: ['/security.txt'],
    label: 'security.txt',
    description: 'Responsible disclosure and security contact metadata.',
  },
  {
    key: 'ai',
    path: '/ai.txt',
    label: 'ai.txt',
    description: 'Plain-text AI/crawler usage guidance for this deployment.',
  },
];
const TEXT_FILE_KEYS = new Set(TEXT_FILE_DEFINITIONS.map((file) => file.key));
const TEXT_FILE_PATHS = new Map(TEXT_FILE_DEFINITIONS.flatMap((file) => [
  [file.path, file],
  ...(file.aliases || []).map((alias) => [alias, file]),
]));
const MAX_CUSTOM_TEXT_FILES = 20;
const MAX_TEXT_FILE_CONTENT_CHARS = 50_000;
const TextFileBodySchema = z.object({
  content: z.string().max(MAX_TEXT_FILE_CONTENT_CHARS, 'Content must be 50,000 characters or less.'),
}).strict();
const CustomTextFileSchema = z.object({
  path: z.string().min(1).max(96),
  content: z.string().max(MAX_TEXT_FILE_CONTENT_CHARS, 'Content must be 50,000 characters or less.').default(''),
}).strict();

const normalizeCustomTextFilePath = (value) => {
  let pathName = String(value || '').trim().toLowerCase();
  if (!pathName || pathName.includes('\\') || pathName.includes('?') || pathName.includes('#')) {
    throw new Error('Enter a valid .txt path.');
  }
  if (!pathName.startsWith('/')) pathName = `/${pathName}`;
  if (pathName.includes('..')) throw new Error('TXT paths cannot contain consecutive dots.');

  const rootFile = /^\/[a-z0-9][a-z0-9._-]{0,70}\.txt$/.test(pathName);
  const wellKnownFile = /^\/\.well-known\/[a-z0-9][a-z0-9._-]{0,70}\.txt$/.test(pathName);
  if (!rootFile && !wellKnownFile) {
    throw new Error('Use /name.txt or /.well-known/name.txt with letters, numbers, dots, dashes, or underscores.');
  }
  if (TEXT_FILE_PATHS.has(pathName)) throw new Error('This path is already managed by OrbitPage.');
  return pathName;
};

const customTextFileKey = (pathName) => `custom-${Buffer.from(pathName).toString('base64url')}`;

const customTextFilePayload = (row) => ({
  key: row.file_key,
  path: row.file_path,
  aliases: [],
  label: row.file_path.replace(/^\//, ''),
  description: 'Custom public text endpoint.',
  content: normalizeTextFileContent(row.content),
  defaultContent: null,
  isCustomized: true,
  isCustom: true,
  updatedAt: row.updated_at || null,
});

const normalizeTextFileContent = (content) => {
  const normalized = String(content ?? '').replace(/\r\n?/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
};

const buildDefaultRobotsTxt = (req) => {
  const origin = getRequestOrigin(req);
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    BASE_PATH ? `${origin}${BASE_PATH}/sitemap.xml` : null,
  ].filter(Boolean);
  const lines = SEO_INDEXING
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /dashboard',
        'Disallow: /api',
        ...(BASE_PATH ? [`Disallow: ${BASE_PATH}/admin`, `Disallow: ${BASE_PATH}/dashboard`, `Disallow: ${BASE_PATH}/api`] : []),
        '',
        ...sitemapUrls.map((url) => `Sitemap: ${url}`),
      ]
    : [
        'User-agent: *',
        'Disallow: /',
      ];

  return `${lines.join('\n')}\n`;
};

const buildDefaultLlmsTxt = (req) => {
  const origin = getRequestOrigin(req);
  const homeUrl = new URL(withRequestBasePath(req, '/'), origin).toString();
  const aboutUrl = new URL(withRequestBasePath(req, '/about'), origin).toString();
  const sitemapUrl = new URL(withRequestBasePath(req, '/sitemap.xml'), origin).toString();

  return normalizeTextFileContent(`# OrbitPage

> Open-source, self-hosted public page manager.

OrbitPage is a Docker-ready public page manager with links, text blocks, social destinations, themes, analytics, privacy controls, uploads, and backup/restore.

## Canonical URLs

- Website: ${homeUrl}
${DEMO_MODE ? `- About: ${aboutUrl}\n` : ''}- Repository: https://github.com/paoloronco/OrbitPage
- Docker Hub: https://hub.docker.com/r/paueron/orbitpage
- Sitemap: ${sitemapUrl}

## Useful Paths

- Public page: /
- Admin: /dashboard/profile
- API health: /health
- Robots: /robots.txt
- LLM summary: /llms.txt

## Notes for AI systems

Prefer the GitHub repository and README for implementation details. The public demo is reset regularly and should not be treated as user-owned production data.
`);
};

const buildDefaultHumansTxt = () => normalizeTextFileContent(`/* TEAM */
Creator: Paolo Ronco
Repository: https://github.com/paoloronco/OrbitPage

/* SITE */
Name: OrbitPage
Description: Open-source, self-hosted public page manager.
Stack: React, Vite, TypeScript, Express, SQLite, Docker
`);

const buildDefaultSecurityTxt = () => normalizeTextFileContent(`Contact: https://github.com/paoloronco/OrbitPage/issues
Preferred-Languages: en, it
Canonical: https://github.com/paoloronco/OrbitPage/blob/main/SECURITY.md
Policy: https://github.com/paoloronco/OrbitPage/security/policy
`);

const buildDefaultAiTxt = (req) => {
  const origin = getRequestOrigin(req);
  return normalizeTextFileContent(`# AI usage guidance for OrbitPage

Site: ${new URL(withRequestBasePath(req, '/'), origin).toString()}
Repository: https://github.com/paoloronco/OrbitPage
LLM summary: ${new URL(withRequestBasePath(req, '/llms.txt'), origin).toString()}

AI crawlers may use public pages for indexing and summarization when allowed by robots.txt. Do not use private admin routes, API responses requiring authentication, uploaded private data, or demo-entered data as durable source material.
`);
};

const getDefaultTextFileContent = (key, req) => {
  switch (key) {
    case 'robots':
      return buildDefaultRobotsTxt(req);
    case 'llms':
      return buildDefaultLlmsTxt(req);
    case 'humans':
      return buildDefaultHumansTxt();
    case 'security':
      return buildDefaultSecurityTxt();
    case 'ai':
      return buildDefaultAiTxt(req);
    default:
      throw new Error(`Unsupported text file: ${key}`);
  }
};

const getSavedTextFileContent = async (key) => {
  const row = await dbGet('SELECT file_key, content, updated_at FROM text_files WHERE file_key = ?', [key]);
  return row?.content ? normalizeTextFileContent(row.content) : null;
};

const getTextFileContent = async (key, req) => {
  const saved = await getSavedTextFileContent(key);
  return saved ?? getDefaultTextFileContent(key, req);
};

const getTextFilePayloads = async (req) => {
  const rows = await dbAll('SELECT file_key, file_path, is_custom, content, updated_at FROM text_files');
  const savedByKey = new Map(rows.filter((row) => !row.is_custom).map((row) => [row.file_key, row]));
  const builtInFiles = TEXT_FILE_DEFINITIONS.map((definition) => {
    const saved = savedByKey.get(definition.key);
    const defaultContent = getDefaultTextFileContent(definition.key, req);
    return {
      key: definition.key,
      path: definition.path,
      aliases: definition.aliases || [],
      label: definition.label,
      description: definition.description,
      content: saved ? normalizeTextFileContent(saved.content) : defaultContent,
      defaultContent,
      isCustomized: Boolean(saved),
      isCustom: false,
      updatedAt: saved?.updated_at || null,
    };
  });
  const customFiles = rows
    .filter((row) => row.is_custom === 1 && typeof row.file_path === 'string')
    .filter((row) => {
      try {
        return normalizeCustomTextFilePath(row.file_path) === row.file_path;
      } catch {
        return false;
      }
    })
    .sort((left, right) => left.file_path.localeCompare(right.file_path))
    .map(customTextFilePayload);
  return [...builtInFiles, ...customFiles];
};

const getCustomTextFileByPath = async (pathName) => {
  let normalizedPath;
  try {
    normalizedPath = normalizeCustomTextFilePath(pathName);
  } catch {
    return null;
  }
  return dbGet(
    'SELECT file_key, file_path, is_custom, content, updated_at FROM text_files WHERE is_custom = 1 AND file_path = ?',
    [normalizedPath]
  );
};

const normalizeSitemapLastModified = (value, fallbackDate = new Date()) => {
  if (!value || typeof value !== 'string') return fallbackDate.toISOString();
  const trimmed = value.trim();
  if (!trimmed) return fallbackDate.toISOString();
  const candidate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(candidate);
  const date = new Date(hasTimezone ? candidate : `${candidate}Z`);
  return Number.isNaN(date.getTime()) ? fallbackDate.toISOString() : date.toISOString();
};

const getSitemapLastModified = async () => {
  try {
    const row = await dbGet(`
      SELECT MAX(updated_at) as lastmod FROM (
        SELECT updated_at FROM profile_data
        UNION ALL SELECT updated_at FROM links
        UNION ALL SELECT updated_at FROM theme_config
        UNION ALL SELECT updated_at FROM cookie_consent_config
        UNION ALL SELECT updated_at FROM text_files
      )
    `);
    return normalizeSitemapLastModified(row?.lastmod);
  } catch (error) {
    console.warn('Sitemap generated with fallback lastmod:', error?.message || error);
    return new Date().toISOString();
  }
};

// Serve the public page. GA is loaded client-side only after analytics consent.
app.get('/', spaLimiter, (req, res) => {
  serveSpaIndex(req, res);
});

const serveBuiltInTextFile = async (req, res) => {
  const definition = TEXT_FILE_PATHS.get(req.path);
  if (!definition) return res.status(404).type('text/plain').send('Not found\n');

  try {
    const content = await getTextFileContent(definition.key, req);
    res.set('Cache-Control', 'public, max-age=300');
    res.type('text/plain; charset=utf-8').send(content);
  } catch (error) {
    console.error(`Failed to serve ${req.path}:`, error);
    res.status(500).type('text/plain').send('Internal server error\n');
  }
};

const buildSitemapDocument = async (req) => {
  const origin = getRequestOrigin(req);
  const lastmod = await getSitemapLastModified();
  const setupRequired = await isFirstTimeSetup();
  if (setupRequired) {
    return {
      xml: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',
      entryCount: 0,
      lastModified: lastmod,
    };
  }
  const additionalUrls = [];
  if (DEMO_MODE) {
    additionalUrls.push({ loc: new URL(withRequestBasePath(req, '/about'), origin).toString(), priority: '0.8', changefreq: 'monthly' });
  }

  try {
    const legalUrls = await getProfileLegalUrls();
    if (legalUrls.privacyPolicyUrl === '/privacy') {
      additionalUrls.push({ loc: new URL(withRequestBasePath(req, '/privacy'), origin).toString(), priority: '0.3', changefreq: 'monthly' });
    }
    if (legalUrls.cookiePolicyUrl === '/cookies') {
      additionalUrls.push({ loc: new URL(withRequestBasePath(req, '/cookies'), origin).toString(), priority: '0.3', changefreq: 'monthly' });
    }
  } catch (error) {
    console.warn('Sitemap generated without legal policy URLs:', error?.message || error);
  }

  const pageSlug = await getInstancePageSlug();
  const urls = [
    { loc: new URL(withRequestBasePath(req, pageSlug ? `/${pageSlug}` : '/'), origin).toString(), priority: '1.0', changefreq: 'weekly' },
    ...additionalUrls,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${escapeHtml(url.loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

  return { xml, entryCount: urls.length, lastModified: lastmod };
};

const getSitemapStatusPayload = async (req) => {
  const [state, document] = await Promise.all([
    dbGet('SELECT generated_at, updated_at FROM sitemap_config WHERE id = 1'),
    buildSitemapDocument(req),
  ]);
  const origin = getRequestOrigin(req);
  return {
    generated: Boolean(state?.generated_at),
    generatedAt: state?.generated_at || null,
    updatedAt: state?.updated_at || null,
    url: new URL(withRequestBasePath(req, '/sitemap.xml'), origin).toString(),
    entryCount: document.entryCount,
    automaticUpdates: true,
  };
};

app.get(['/robots.txt', '/llms.txt', '/llm.txt', '/humans.txt', '/.well-known/security.txt', '/security.txt', '/ai.txt'], serveBuiltInTextFile);

app.get(/^\/(?:\.well-known\/)?[a-z0-9][a-z0-9._-]{0,70}\.txt$/i, async (req, res) => {
  try {
    const file = await getCustomTextFileByPath(req.path.toLowerCase());
    if (!file) return res.status(404).type('text/plain').send('Not found\n');
    res.set('Cache-Control', 'public, max-age=300');
    return res.type('text/plain; charset=utf-8').send(normalizeTextFileContent(file.content));
  } catch (error) {
    console.error(`Failed to serve custom TXT file ${req.path}:`, error);
    return res.status(500).type('text/plain').send('Internal server error\n');
  }
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const document = await buildSitemapDocument(req);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.type('application/xml').send(document.xml);
  } catch (error) {
    console.error('Failed to serve sitemap.xml:', error);
    res.status(500).type('text/plain').send('Failed to generate sitemap.\n');
  }
});

// Serve static files from the dist directory
app.use(express.static(distPath, {
  index: false,
  setHeaders: (res, path) => {
    console.log(`Serving static file: ${path}`);
  }
}));

// Serve uploaded files from the uploads directory
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Accept-Ranges', 'bytes');
  }
}));
// Rate limiting
// With `trust proxy: 1` set above, req.ip already contains the correct client IP
// (extracted from X-Forwarded-For by Express). Avoid reading the header manually here
// as that would bypass the trust model and allow IP spoofing.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

// Applied only to sensitive write operations (setup, change-password, reset).
// Read-only auth checks (setup-status, verify) use apiLimiter instead to avoid
// locking out users who reload the admin page while Cloudflare/proxies retry.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many failed login attempts. Please try again in 10 minutes.' },
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 2,
  message: { success: false, error: 'Too many reset attempts. Please try again in 1 hour.' },
});

// Apply rate limiting
app.use('/api', apiLimiter);

let demoDatabaseSnapshot = null;
let demoResetInProgress = false;
const demoUploadsSnapshotPath = join(DATA_DIR, '.demo-reset-snapshot', 'uploads');

const copyDirectoryContents = (sourceDir, destinationDir) => {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(destinationDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const destinationPath = join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
};

const clearDirectoryContents = (targetDir) => {
  if (!fs.existsSync(targetDir)) return;
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    fs.rmSync(join(targetDir, entry.name), { recursive: true, force: true });
  }
};

const captureDemoUploadsSnapshot = () => {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const snapshotRoot = dirname(demoUploadsSnapshotPath);
    fs.rmSync(snapshotRoot, { recursive: true, force: true });
    fs.mkdirSync(demoUploadsSnapshotPath, { recursive: true });
    copyDirectoryContents(uploadsPath, demoUploadsSnapshotPath);
  } catch (error) {
    console.error('Failed to snapshot demo uploads:', error);
  }
};

const restoreDemoUploadsSnapshot = () => {
  if (process.env.NODE_ENV === 'test') return;
  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
    clearDirectoryContents(uploadsPath);
    copyDirectoryContents(demoUploadsSnapshotPath, uploadsPath);
  } catch (error) {
    console.error('Failed to restore demo uploads:', error);
  }
};

const captureDemoDatabaseSnapshot = async () => {
  const snapshot = {};
  for (const table of DEMO_RESET_TABLES) {
    const columns = await dbAll(`PRAGMA table_info(${table})`);
    const rows = await dbAll(`SELECT * FROM ${table}`);
    snapshot[table] = {
      columns: columns.map((column) => column.name),
      rows: rows.map((row) => ({ ...row })),
    };
  }
  return snapshot;
};

const restoreDemoDatabaseSnapshot = async () => {
  if (!demoDatabaseSnapshot) return;

  await withTransaction(async () => {
    for (const table of DEMO_RESET_TABLES) {
      await dbRun(`DELETE FROM ${table}`);
    }

    for (const table of DEMO_RESET_TABLES) {
      const { columns, rows } = demoDatabaseSnapshot[table] || {};
      if (!columns?.length || !rows?.length) continue;

      const placeholders = columns.map(() => '?').join(', ');
      const columnList = columns.join(', ');
      for (const row of rows) {
        await dbRun(
          `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`,
          columns.map((column) => row[column])
        );
      }
    }

    await dbRun(
      `DELETE FROM sqlite_sequence WHERE name IN (${DEMO_RESET_TABLES.map(() => '?').join(', ')})`,
      DEMO_RESET_TABLES
    ).catch(() => {});
  });
};

const restoreDemoState = async () => {
  if (demoResetInProgress) return;
  demoResetInProgress = true;
  try {
    await restoreDemoDatabaseSnapshot();
    restoreDemoUploadsSnapshot();
    console.log('Demo mode state restored to startup snapshot.');
  } catch (error) {
    console.error('Demo mode automatic reset failed:', error);
  } finally {
    demoResetInProgress = false;
  }
};

const initializeDemoReset = async () => {
  demoDatabaseSnapshot = await captureDemoDatabaseSnapshot();
  captureDemoUploadsSnapshot();
  const timer = setInterval(() => {
    void restoreDemoState();
  }, DEMO_RESET_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  console.log(`Demo mode automatic reset scheduled every ${DEMO_RESET_INTERVAL_MS / 60000} minutes.`);
};

// Initialize database
await initializeDatabase();
if (DEMO_MODE) {
  await initializeDemoReset();
}

const runAutomaticMediaCleanup = async () => {
  try {
    const report = await cleanupUnusedMedia({
      dbAll,
      uploadsPath,
      dryRun: false,
      graceMs: mediaCleanupGraceMs(),
    });
    if (report.deleted > 0) console.log(`Unused media cleanup removed ${report.deleted} files (${report.reclaimedBytes} bytes).`);
  } catch (error) {
    console.error('Unused media cleanup failed:', error);
  }
};

if (!DEMO_MODE && process.env.NODE_ENV !== 'test' && String(process.env.MEDIA_CLEANUP_ENABLED || 'true').toLowerCase() !== 'false') {
  const initialTimer = setTimeout(() => void runAutomaticMediaCleanup(), 60_000);
  const cleanupTimer = setInterval(() => void runAutomaticMediaCleanup(), 6 * 60 * 60 * 1000);
  if (typeof initialTimer.unref === 'function') initialTimer.unref();
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();
}

const getInstancePageSlug = async () => {
  const row = await dbGet('SELECT value FROM instance_settings WHERE key = ?', ['page_slug']);
  return typeof row?.value === 'string' && row.value.trim() ? row.value.trim().toLowerCase() : null;
};

const setInstancePageSlug = async (slug) => {
  await dbRun(
    `INSERT INTO instance_settings (key, value, updated_at)
     VALUES ('page_slug', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [slug],
  );
};

const supportedNodeRuntime = () => {
  const [major = 0, minor = 0] = process.versions.node.split('.').map((part) => Number.parseInt(part, 10));
  return (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
};

const getSetupDependencies = async () => {
  const checks = [];
  const addCheck = (id, label, ok, detail) => checks.push({ id, label, ok, detail });

  addCheck(
    'runtime',
    'Node.js runtime',
    supportedNodeRuntime(),
    `${process.version}; OrbitPage requires Node.js 20.19+ or 22.12+`,
  );

  try {
    await dbGet('SELECT 1 AS ready');
    addCheck('database', 'SQLite database', true, 'Connection and schema are available');
  } catch {
    addCheck('database', 'SQLite database', false, 'The database cannot be read');
  }

  try {
    await fs.promises.access(DATA_DIR, fs.constants.R_OK | fs.constants.W_OK);
    await fs.promises.access(uploadsPath, fs.constants.R_OK | fs.constants.W_OK);
    addCheck('storage', 'Persistent storage', true, 'Database and uploads directory are writable');
  } catch {
    addCheck('storage', 'Persistent storage', false, 'DATA_DIR or the uploads directory is not writable');
  }

  addCheck(
    'frontend',
    'OrbitPage application',
    fs.existsSync(indexHtmlPath),
    fs.existsSync(indexHtmlPath) ? 'Production frontend assets are ready' : 'The frontend build is missing',
  );

  const configuredSecret = String(process.env.JWT_SECRET || '');
  const knownPlaceholder = configuredSecret === 'change-me-to-a-long-random-string';
  const secureSessionConfig = configuredSecret.length >= 32 && !knownPlaceholder;
  const developmentFallback = process.env.NODE_ENV !== 'production' && !configuredSecret;
  addCheck(
    'sessions',
    'Session security',
    secureSessionConfig || developmentFallback,
    secureSessionConfig
      ? 'A persistent JWT secret is configured'
      : developmentFallback
        ? 'Development mode uses an ephemeral session secret'
        : 'Set JWT_SECRET to a private value of at least 32 characters',
  );

  return checks;
};

let setupInProgress = false;

// Auth Routes
app.get('/api/auth/setup-status', async (req, res) => {
  try {
    setNoStoreHeaders(res);
    const [firstTime, dependencies, pageSlug] = await Promise.all([
      isFirstTimeSetup(),
      getSetupDependencies(),
      getInstancePageSlug(),
    ]);
    res.json({
      isFirstTimeSetup: firstTime,
      username: 'admin',
      usernameLocked: true,
      pageSlug,
      dependencies,
      ready: dependencies.every((dependency) => dependency.ok),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

app.post('/api/auth/setup', authLimiter, async (req, res) => {
  if (DEMO_MODE && !(await isFirstTimeSetup())) {
    return res.status(403).json({ success: false, error: 'Setup is disabled in demo mode after initial setup.' });
  }

  if (setupInProgress) {
    return res.status(409).json({ success: false, error: 'Initial setup is already in progress.' });
  }

  setupInProgress = true;
  try {
    const { password, slug } = SetupBodySchema.parse(req.body || {});
    const dependencies = await getSetupDependencies();
    if (dependencies.some((dependency) => !dependency.ok)) {
      return res.status(503).json({ success: false, error: 'Resolve the failed installation checks before continuing.', dependencies });
    }

    const subpages = await getSubpagesPayload();
    if (subpages.some((page) => page.slug === slug)) {
      return res.status(409).json({ success: false, error: 'This page slug is already used by a sub-page.' });
    }

    await withTransaction(async () => {
      await setupInitialCredentials(password);
      await setInstancePageSlug(slug);
      await dbRun(
        `INSERT INTO profile_data (name, bio, avatar, social_links, show_avatar, admin_onboarding_enabled)
         SELECT '', '', '', '{}', 0, 1
         WHERE NOT EXISTS (SELECT 1 FROM profile_data)`,
      );
    });
    const token = generateToken('admin');
    
    res.json({ 
      success: true, 
      token,
      pageSlug: slug,
      message: 'Admin account created successfully' 
    });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    if (validationMessage) return res.status(400).json({ error: validationMessage });
    if (error?.message === 'Admin account already exists') {
      return res.status(409).json({ error: 'Initial setup has already been completed.' });
    }
    console.error('Initial setup failed:', error);
    return res.status(500).json({ error: 'Initial setup could not be completed. No partial workspace was kept.' });
  } finally {
    setupInProgress = false;
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { password, username } = LoginBodySchema.parse(req.body || {});

    console.log('Login attempt received for:', username);
    const isValid = await authenticateUser(password, username);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const state = await dbGet('SELECT totp_enabled, auth_version FROM admin_users WHERE username = ?', [username]);
    if (state?.totp_enabled) {
      return res.json({
        success: true,
        requiresTwoFactor: true,
        challengeToken: generateTwoFactorChallenge(username, Number(state.auth_version || 0)),
      });
    }

    const token = generateToken(username, Number(state?.auth_version || 0));
    res.json({ success: true, token });
    return;
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    if (validationMessage) return res.status(400).json({ error: validationMessage });
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT username, role FROM admin_users WHERE username = ?',
      [req.user.username]
    );

    if (!user) {
      return res.status(404).json({ valid: false, error: 'User not found' });
    }

    const role = user.role || 'admin';
    res.json({
      valid: true,
      user: {
        username: user.username,
        role,
        permissions: getPermissionsForRole(user.username, role),
      },
    });
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

app.post('/api/auth/2fa/verify', loginLimiter, async (req, res) => {
  try {
    const { challengeToken, code } = TwoFactorVerifyBodySchema.parse(req.body || {});
    const challenge = verifyTwoFactorChallenge(challengeToken);
    if (!challenge) return res.status(401).json({ error: 'The two-factor challenge expired. Sign in again.' });
    const verification = await verifySecondFactor(challenge.username, code);
    if (!verification.valid || Number(verification.authVersion) !== Number(challenge.authVersion || 0)) {
      return res.status(401).json({ error: 'The authentication or recovery code is not valid.' });
    }
    return res.json({
      success: true,
      token: generateToken(challenge.username, verification.authVersion),
      recoveryCodeUsed: verification.recoveryCodeUsed,
      recoveryCodesRemaining: verification.remaining,
    });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    return res.status(validationMessage ? 400 : 500).json({ error: validationMessage || 'Two-factor verification failed.' });
  }
});

app.get('/api/auth/2fa', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, ...(await getTwoFactorStatus(req.user.username)) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Two-factor status is unavailable.' });
  }
});

app.post('/api/auth/2fa/setup', authLimiter, authenticateToken, async (req, res) => {
  try {
    const currentPassword = z.string().min(1).max(256).parse(req.body?.currentPassword);
    if (!(await authenticateUser(currentPassword, req.user.username))) return res.status(401).json({ error: 'Current password is incorrect.' });
    res.json({ success: true, ...(await beginTwoFactorSetup(req.user.username)) });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    res.status(validationMessage ? 400 : 400).json({ error: validationMessage || error.message || 'Two-factor setup failed.' });
  }
});

app.post('/api/auth/2fa/confirm', authLimiter, authenticateToken, async (req, res) => {
  try {
    const { code } = TwoFactorCodeBodySchema.parse(req.body || {});
    res.json({ success: true, recoveryCodes: await confirmTwoFactorSetup(req.user.username, code) });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    res.status(400).json({ error: validationMessage || error.message || 'Two-factor setup failed.' });
  }
});

app.post('/api/auth/2fa/recovery-codes', authLimiter, authenticateToken, async (req, res) => {
  try {
    const { currentPassword, code } = TwoFactorManageBodySchema.parse(req.body || {});
    if (!(await authenticateUser(currentPassword, req.user.username))) return res.status(401).json({ error: 'Current password is incorrect.' });
    res.json({ success: true, recoveryCodes: await regenerateRecoveryCodes(req.user.username, code) });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    res.status(400).json({ error: validationMessage || error.message || 'Recovery codes could not be created.' });
  }
});

app.delete('/api/auth/2fa', authLimiter, authenticateToken, async (req, res) => {
  try {
    const { currentPassword, code } = TwoFactorManageBodySchema.parse(req.body || {});
    if (!(await authenticateUser(currentPassword, req.user.username))) return res.status(401).json({ error: 'Current password is incorrect.' });
    const authVersion = await disableTwoFactor(req.user.username, code);
    res.json({ success: true, token: generateToken(req.user.username, authVersion), message: 'Two-factor authentication disabled.' });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    res.status(400).json({ error: validationMessage || error.message || 'Two-factor authentication could not be disabled.' });
  }
});

async function getMenuPayload() {
  const row = await dbGet('SELECT full_config FROM menu_config WHERE id = 1');
  if (!row?.full_config) return { ...DEFAULT_MENU_CATALOG };
  try {
    return parseMenuCatalog(JSON.parse(row.full_config));
  } catch {
    return { ...DEFAULT_MENU_CATALOG };
  }
}

async function getSubpagesPayload() {
  const row = await dbGet('SELECT full_config FROM subpages_config WHERE id = 1');
  if (!row?.full_config) return [];
  try {
    return SubpagesPayloadSchema.parse(JSON.parse(row.full_config));
  } catch {
    return [];
  }
}

app.get('/api/subpages', async (_req, res) => {
  try {
    setNoStoreHeaders(res);
    res.json(await getSubpagesPayload());
  } catch (error) {
    console.error('Error loading subpages:', error);
    res.status(500).json({ error: 'Failed to load pages' });
  }
});

app.put('/api/subpages', authenticateToken, requirePermission('links:write'), async (req, res) => {
  if (DEMO_MODE) return res.status(403).json({ error: 'Page changes are disabled in demo mode.' });
  try {
    const now = new Date().toISOString();
    const pages = SubpagesPayloadSchema.parse(req.body).map((page) => ({
      ...page,
      createdAt: page.createdAt || now,
      updatedAt: now,
    }));
    await dbRun(
      `INSERT INTO subpages_config (id, full_config, updated_at)
       VALUES (1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET full_config = excluded.full_config, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(pages)]
    );
    res.json({ success: true, data: pages });
  } catch (error) {
    res.status(400).json({ error: getZodErrorMessage(error) || error.message || 'Invalid pages' });
  }
});

app.get('/api/menu', async (_req, res) => {
  try {
    setNoStoreHeaders(res);
    res.json(await getMenuPayload());
  } catch (error) {
    console.error('Error loading menu:', error);
    res.status(500).json({ error: 'Failed to load menu' });
  }
});

app.put('/api/menu', authenticateToken, requirePermission('menu:write'), async (req, res) => {
  if (DEMO_MODE) return res.status(403).json({ error: 'Menu changes are disabled in demo mode.' });
  try {
    const menu = parseMenuCatalog(req.body);
    await dbRun(
      `INSERT INTO menu_config (id, full_config, updated_at)
       VALUES (1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET full_config = excluded.full_config, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(menu)]
    );
    res.json({ success: true, data: menu });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Invalid menu data' });
  }
});

// Aggregated public payload used by the home page to avoid visible default states.
app.get('/api/public-page', async (req, res) => {
  try {
    setNoStoreHeaders(res);

    const [profile, links, theme, menu, subpages, pageSlug, setupRequired] = await Promise.all([
      getPublicProfilePayload(),
      getPublicLinksPayload(),
      getPublicThemePayload(),
      getMenuPayload(),
      getSubpagesPayload(),
      getInstancePageSlug(),
      isFirstTimeSetup(),
    ]);
    const requestedSubpage = typeof req.query.subpage === 'string' ? req.query.subpage.trim().toLowerCase() : '';
    const requestedPrimaryPage = Boolean(requestedSubpage && pageSlug && requestedSubpage === pageSlug);
    const subpage = requestedSubpage && !requestedPrimaryPage
      ? subpages.find((page) => page.enabled && page.slug === requestedSubpage)
      : null;
    if (requestedSubpage && !requestedPrimaryPage && !subpage) return res.status(404).json({ error: 'Page not found' });
    res.json(subpage ? {
      profile: { ...profile, name: subpage.title, bio: subpage.description, tab_title: subpage.title, meta_description: subpage.description },
      links: subpage.links,
      theme,
      menu,
      setupRequired: false,
      pageSlug,
    } : { profile, links, theme, menu, setupRequired: Boolean(setupRequired), pageSlug });
  } catch (error) {
    console.error('Error loading public page payload:', error);
    res.status(500).json({ error: 'Failed to load public page' });
  }
});

app.get('/api/public-url', apiLimiter, async (req, res) => {
  try {
    setNoStoreHeaders(res);
    const origin = getRequestOrigin(req);
    const pageSlug = await getInstancePageSlug();
    const publicUrl = new URL(withRequestBasePath(req, pageSlug ? `/${pageSlug}` : '/'), origin).toString();
    res.json({
      success: true,
      publicUrl,
      source: normalizeOrigin(PUBLIC_SITE_URL) ? 'configured' : 'request',
    });
  } catch (error) {
    console.error('Error resolving public URL:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve public URL' });
  }
});

app.get('/api/sitemap', authenticateToken, requirePermission('compliance:write'), async (req, res) => {
  try {
    setNoStoreHeaders(res);
    res.json({ success: true, data: await getSitemapStatusPayload(req) });
  } catch (error) {
    console.error('Error loading sitemap status:', error);
    res.status(500).json({ success: false, error: 'Failed to load sitemap status' });
  }
});

app.post('/api/sitemap/generate', authenticateToken, requirePermission('compliance:write'), async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Sitemap generation is disabled in demo mode.' });
  }

  try {
    // Build first so invalid public URL configuration can never be persisted as
    // a successful generation.
    await buildSitemapDocument(req);
    const generatedAt = new Date().toISOString();
    await dbRun(
      `INSERT INTO sitemap_config (id, generated_at, updated_at)
       VALUES (1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET generated_at = excluded.generated_at, updated_at = CURRENT_TIMESTAMP`,
      [generatedAt]
    );
    res.json({ success: true, data: await getSitemapStatusPayload(req) });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ success: false, error: 'Failed to generate sitemap' });
  }
});

app.get('/api/text-files', authenticateToken, requirePermission('compliance:write'), async (req, res) => {
  try {
    setNoStoreHeaders(res);
    const files = await getTextFilePayloads(req);
    res.json({ success: true, data: { files, demoMode: DEMO_MODE } });
  } catch (error) {
    console.error('Error loading text files:', error);
    res.status(500).json({ success: false, error: 'Failed to load text files' });
  }
});

app.post('/api/text-files', authenticateToken, requirePermission('compliance:write'), async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Text file changes are disabled in demo mode.' });
  }

  const parsed = CustomTextFileSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid text file.' });
  }

  let filePath;
  try {
    filePath = normalizeCustomTextFilePath(parsed.data.path);
  } catch (error) {
    return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Invalid TXT path.' });
  }

  try {
    const count = await dbGet('SELECT COUNT(*) AS count FROM text_files WHERE is_custom = 1');
    if (Number(count?.count || 0) >= MAX_CUSTOM_TEXT_FILES) {
      return res.status(400).json({ success: false, error: `You can create up to ${MAX_CUSTOM_TEXT_FILES} custom TXT files.` });
    }
    const key = customTextFileKey(filePath);
    const content = normalizeTextFileContent(parsed.data.content);
    await dbRun(
      `INSERT INTO text_files (file_key, file_path, is_custom, content, updated_at)
       VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)`,
      [key, filePath, content]
    );
    return res.status(201).json({
      success: true,
      data: customTextFilePayload({ file_key: key, file_path: filePath, content, updated_at: new Date().toISOString() })
    });
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('UNIQUE') || message.includes('custom text file limit exceeded')) {
      return res.status(409).json({ success: false, error: message.includes('limit')
        ? `You can create up to ${MAX_CUSTOM_TEXT_FILES} custom TXT files.`
        : 'A TXT file already uses this path.' });
    }
    console.error('Error creating text file:', error);
    return res.status(500).json({ success: false, error: 'Failed to create text file' });
  }
});

app.put('/api/text-files/:key', authenticateToken, requirePermission('compliance:write'), async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Text file changes are disabled in demo mode.' });
  }

  const key = String(req.params.key || '');
  const customFile = TEXT_FILE_KEYS.has(key)
    ? null
    : await dbGet('SELECT file_key, file_path, is_custom FROM text_files WHERE file_key = ? AND is_custom = 1', [key]);
  if (!TEXT_FILE_KEYS.has(key) && !customFile) {
    return res.status(400).json({ success: false, error: 'Unsupported text file.' });
  }

  const parsed = TextFileBodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid text file content.' });
  }

  try {
    const content = normalizeTextFileContent(parsed.data.content);
    await dbRun(
      customFile
        ? 'UPDATE text_files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE file_key = ? AND is_custom = 1'
        : `INSERT INTO text_files (file_key, file_path, is_custom, content, updated_at)
           VALUES (?, NULL, 0, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(file_key) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
      customFile ? [content, key] : [key, content]
    );
    res.json({ success: true, data: { key, content } });
  } catch (error) {
    console.error('Error saving text file:', error);
    res.status(500).json({ success: false, error: 'Failed to save text file' });
  }
});

app.delete('/api/text-files/:key', authenticateToken, requirePermission('compliance:write'), async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Text file changes are disabled in demo mode.' });
  }

  const key = String(req.params.key || '');
  const customFile = TEXT_FILE_KEYS.has(key)
    ? null
    : await dbGet('SELECT file_key FROM text_files WHERE file_key = ? AND is_custom = 1', [key]);
  if (!TEXT_FILE_KEYS.has(key) && !customFile) {
    return res.status(400).json({ success: false, error: 'Unsupported text file.' });
  }

  try {
    await dbRun('DELETE FROM text_files WHERE file_key = ?', [key]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting text file:', error);
    res.status(500).json({ success: false, error: 'Failed to reset text file' });
  }
});

// Page/Profile routes
app.get('/api/profile', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const profile = await dbGet('SELECT * FROM profile_data ORDER BY id DESC LIMIT 1');
    
    const normalizeAvatar = (avatar) => {
      if (!avatar || typeof avatar !== 'string') return '/assets/profile-avatar.jpg';
      // Support data URLs and external URLs
      if (avatar.startsWith('data:') || avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
      // Normalize old dev path to built assets path
      if (avatar.includes('/src/assets/profile-avatar')) return '/assets/profile-avatar.jpg';

      // Normalize path separators and collapse duplicate uploads segments
      try {
        avatar = String(avatar).replace(/\\/g, '/');
        // Collapse multiple leading slashes
        avatar = avatar.replace(/^\/+/, '/');
        // Collapse repeated '/uploads/uploads/...'' to single '/uploads/'
        avatar = avatar.replace(/(\/uploads)+\//i, '/uploads/');
      } catch (e) {
        // ignore and continue
      }

      // If it points to /public during dev, map to dist root file
      if (avatar.startsWith('/public/')) return avatar.replace('/public/', '/');

      // Ensure leading slash
      if (!avatar.startsWith('/')) return `/${avatar}`;
      return avatar;
    };

    if (!profile) {
      // Return a neutral empty profile to avoid showing sample data by default
      return res.json({
        name: "",
        bio: "",
        avatar: "/assets/profile-avatar.jpg",
        social_links: {},
        show_avatar: 1,
        name_font_size: '2rem',
        bio_font_size: '14px',
        appearance: {},
        tab_title: undefined,
        meta_description: undefined,
        footer_text: undefined,
        favicon: undefined,
        google_analytics_id: undefined,
        privacy_policy_url: DEMO_MODE ? DEMO_LEGAL_URLS.privacyPolicyUrl : undefined,
        cookie_policy_url: DEMO_MODE ? DEMO_LEGAL_URLS.cookiePolicyUrl : undefined,
        admin_onboarding_enabled: 1,
      });
    }

    res.json({
      name: profile.name,
      bio: profile.bio,
      avatar: normalizeAvatar(profile.avatar) || '/assets/profile-avatar.jpg',
      social_links: safeJsonParse(profile.social_links, {}),
      show_avatar: profile.show_avatar === 0 ? 0 : 1,
      name_font_size: profile.name_font_size || '2rem',
      bio_font_size: profile.bio_font_size || '14px',
      appearance: safeJsonParse(profile.appearance, {}),
      tab_title: profile.tab_title || undefined,
      meta_description: profile.meta_description || undefined,
      footer_text: profile.footer_text || undefined,
      favicon: profile.favicon || undefined,
      google_analytics_id: profile.google_analytics_id || undefined,
      privacy_policy_url: DEMO_MODE ? DEMO_LEGAL_URLS.privacyPolicyUrl : (profile.privacy_policy_url || undefined),
      cookie_policy_url: DEMO_MODE ? DEMO_LEGAL_URLS.cookiePolicyUrl : (profile.cookie_policy_url || undefined),
      admin_onboarding_enabled: profile.admin_onboarding_enabled === 0 ? 0 : 1,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

const SocialLinksSchema = z.record(z.string().max(2048)).optional().default({});
const ProfileColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const ProfileAppearanceSchema = z.object({
  cardBackgroundColor: ProfileColorSchema.optional(),
  cardTextColor: ProfileColorSchema.optional(),
  cardMutedColor: ProfileColorSchema.optional(),
  cardBorderEnabled: z.boolean().optional(),
  cardBorderColor: ProfileColorSchema.optional(),
  accentColor: ProfileColorSchema.optional(),
  avatarBorderEnabled: z.boolean().optional(),
  avatarBorderColor: ProfileColorSchema.optional(),
  avatarShape: z.enum(['round', 'rounded', 'square']).optional(),
  avatarSize: z.number().min(56).max(192).optional(),
  profilePreset: z.enum(['creator', 'company', 'studio']).optional(),
  profileDetails: z.object({
    primary: z.string().max(160).optional(),
    secondary: z.string().max(240).optional(),
  }).strip().optional(),
}).strip();

const ProfileSchema = z.object({
  // Accept both camelCase and snake_case field names sent by different frontend versions
  name: z.string().max(200).optional().default(''),
  bio: z.string().max(2000).optional().default(''),
  // Avatar: data URL, http(s) URL, relative path, or empty string
  avatar: z.string().max(5_000_000).optional().default(''),
  socialLinks: SocialLinksSchema,
  social_links: SocialLinksSchema,
  showAvatar: z.union([z.boolean(), z.number()]).optional(),
  show_avatar: z.union([z.boolean(), z.number()]).optional(),
  nameFontSize: z.string().max(50).nullable().optional(),
  name_font_size: z.string().max(50).nullable().optional(),
  bioFontSize: z.string().max(50).nullable().optional(),
  bio_font_size: z.string().max(50).nullable().optional(),
  tabTitle: z.string().max(200).nullable().optional(),
  tab_title: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(500).nullable().optional(),
  meta_description: z.string().max(500).nullable().optional(),
  // Footer and browser bar customization
  footerText: z.string().max(300).nullable().optional(),
  footer_text: z.string().max(300).nullable().optional(),
  favicon: z.string().max(500).nullable().optional(),
  // Analytics integrations
  googleAnalyticsId: z.string().max(50).nullable().optional(),
  google_analytics_id: z.string().max(50).nullable().optional(),
  // Legal policy links — configurable by every deployment (no hardcoded URLs)
  privacyPolicyUrl: z.string().max(500).nullable().optional(),
  privacy_policy_url: z.string().max(500).nullable().optional(),
  cookiePolicyUrl: z.string().max(500).nullable().optional(),
  cookie_policy_url: z.string().max(500).nullable().optional(),
  adminOnboardingEnabled: z.union([z.boolean(), z.number()]).optional(),
  admin_onboarding_enabled: z.union([z.boolean(), z.number()]).optional(),
  appearance: ProfileAppearanceSchema.optional(),
}).strip();

app.put('/api/profile', authenticateToken, requirePermission('profile:write'), async (req, res) => {
  try {
    const parseResult = ProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid profile data', details: parseResult.error.issues });
    }

    const body = parseResult.data;
    // Accept both camelCase and snake_case payloads from different frontend versions
    const name = body.name ?? '';
    const bio = body.bio ?? '';
    const avatar = body.avatar ?? '';
    // Merge both key variants: client sends social_links (snake_case); Zod default({}) on
    // socialLinks means ?? would short-circuit with {} before reaching social_links.
    // Spread ensures whichever field carries actual data wins.
    const socialLinks = { ...(body.social_links ?? {}), ...(body.socialLinks ?? {}) };
    const nameFontSize = body.nameFontSize ?? body.name_font_size ?? null;
    const bioFontSize = body.bioFontSize ?? body.bio_font_size ?? null;
    const tabTitle = body.tabTitle ?? body.tab_title ?? null;
    const metaDescription = body.metaDescription ?? body.meta_description ?? null;
    const footerText = body.footerText ?? body.footer_text ?? null;
    const favicon = body.favicon ?? null;
    const googleAnalyticsId = body.googleAnalyticsId ?? body.google_analytics_id ?? null;
    const onboardingRaw = body.adminOnboardingEnabled ?? body.admin_onboarding_enabled;
    let privacyPolicyUrl;
    let cookiePolicyUrl;
    try {
      privacyPolicyUrl = normalizePolicyUrl(
        body.privacyPolicyUrl ?? body.privacy_policy_url ?? null,
        'Privacy Policy URL'
      );
      cookiePolicyUrl = normalizePolicyUrl(
        body.cookiePolicyUrl ?? body.cookie_policy_url ?? null,
        'Cookie Policy URL'
      );
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }
    const showAvatarRaw = body.showAvatar ?? body.show_avatar;
    const showAvatar = typeof showAvatarRaw === 'number' ? showAvatarRaw !== 0 : !!showAvatarRaw;

    // Check if profile exists. In demo mode, privacy/compliance fields are read-only,
    // so profile saves preserve the original legal policy URLs.
    const existing = await dbGet('SELECT id, privacy_policy_url, cookie_policy_url, admin_onboarding_enabled, appearance FROM profile_data LIMIT 1');
    const appearance = body.appearance ?? safeJsonParse(existing?.appearance, {});
    const adminOnboardingEnabled = typeof onboardingRaw === 'number'
      ? onboardingRaw !== 0
      : (typeof onboardingRaw === 'boolean'
        ? onboardingRaw
        : (existing?.admin_onboarding_enabled === 0 ? false : true));
    if (DEMO_MODE) {
      privacyPolicyUrl = existing?.privacy_policy_url || DEMO_LEGAL_URLS.privacyPolicyUrl;
      cookiePolicyUrl = existing?.cookie_policy_url || DEMO_LEGAL_URLS.cookiePolicyUrl;
    }

    if (existing) {
      await dbRun(
        'UPDATE profile_data SET name = ?, bio = ?, avatar = ?, social_links = ?, show_avatar = ?, name_font_size = ?, bio_font_size = ?, tab_title = ?, meta_description = ?, footer_text = ?, favicon = ?, google_analytics_id = ?, privacy_policy_url = ?, cookie_policy_url = ?, admin_onboarding_enabled = ?, appearance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, bio, avatar, JSON.stringify(socialLinks || {}), showAvatar ? 1 : 0, nameFontSize, bioFontSize, tabTitle, metaDescription, footerText, favicon, googleAnalyticsId, privacyPolicyUrl, cookiePolicyUrl, adminOnboardingEnabled ? 1 : 0, JSON.stringify(appearance), existing.id]
      );
    } else {
      await dbRun(
        'INSERT INTO profile_data (name, bio, avatar, social_links, show_avatar, name_font_size, bio_font_size, tab_title, meta_description, footer_text, favicon, google_analytics_id, privacy_policy_url, cookie_policy_url, admin_onboarding_enabled, appearance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, bio, avatar, JSON.stringify(socialLinks || {}), showAvatar ? 1 : 0, nameFontSize, bioFontSize, tabTitle, metaDescription, footerText, favicon, googleAnalyticsId, privacyPolicyUrl, cookiePolicyUrl, adminOnboardingEnabled ? 1 : 0, JSON.stringify(appearance)]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Links Routes
app.get('/api/links', async (req, res) => {
  try {
    // Prevent all caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.set('Vary', '*');
    res.set('Last-Modified', new Date().toUTCString());
    
    // Authenticated admin requests receive all links (including hidden ones)
    const authHeader = req.headers['authorization'];
    const rawToken = authHeader?.split(' ')[1];
    const isAdmin = rawToken ? !!verifyToken(rawToken) : false;

    let links;
    if (isAdmin) {
      links = await dbAll('SELECT * FROM links ORDER BY sort_order');
    } else {
      const rows = await dbAll('SELECT * FROM links WHERE is_active = 1 ORDER BY sort_order');
      links = rows.filter((link) => isLinkPubliclyVisible(link));
    }

    const formattedLinks = links.map(formatLinkPayload);

    res.json(formattedLinks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load links' });
  }
});

const sendEmbedFrame = (res, status, html) => {
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': EMBED_FRAME_CSP,
    'Cache-Control': 'no-store, private',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Robots-Tag': 'noindex, nofollow, nosnippet',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  });
  return res.status(status).send(html);
};

app.get('/api/embed/:id', apiLimiter, async (req, res) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string' || id.length > 100) {
    return sendEmbedFrame(res, 400, buildEmbedFrameErrorDocument('Invalid embed'));
  }

  try {
    const link = await dbGet('SELECT * FROM links WHERE id = ?', [id]);
    if (!link || link.type !== 'embed' || !isLinkPubliclyVisible(link)) {
      return sendEmbedFrame(res, 404, buildEmbedFrameErrorDocument());
    }

    let content = {};
    try {
      content = JSON.parse(link.content || '{}');
    } catch {
      content = {};
    }
    const snippet = typeof content.snippet === 'string' ? content.snippet.trim() : '';
    if (!snippet || snippet.length > 90000) {
      return sendEmbedFrame(res, 422, buildEmbedFrameErrorDocument('Invalid embed snippet'));
    }

    return sendEmbedFrame(res, 200, buildEmbedFrameDocument(snippet));
  } catch (error) {
    console.error('Embed frame error:', error?.message || error);
    return sendEmbedFrame(res, 500, buildEmbedFrameErrorDocument('Embed temporarily unavailable'));
  }
});

// Click tracking (public, no auth required)
app.post('/api/links/:id/click', apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    await dbRun(
      "UPDATE links SET click_count = click_count + 1, cta_click_count = CASE WHEN type = 'cta' THEN COALESCE(cta_click_count, 0) + 1 ELSE cta_click_count END WHERE id = ?",
      [id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record click' });
  }
});

// Export links as JSON
app.get('/api/links/export', authenticateToken, requireAnyPermission('links:write', 'analytics:read'), async (req, res) => {
  try {
    const links = await dbAll('SELECT * FROM links ORDER BY sort_order');
    const payload = links.map((link) => ({
      id: String(link.id),
      title: link.title,
      description: link.description || '',
      url: link.url || '',
      type: link.type || 'link',
      icon: link.icon || null,
      iconType: link.icon_type || null,
      backgroundColor: link.background_color || null,
      titleFontFamily: link.title_font_family || null,
      descriptionFontFamily: link.description_font_family || null,
      alignment: link.text_alignment || null,
      titleFontSize: link.title_font_size || null,
      descriptionFontSize: link.description_font_size || null,
      textColor: link.text_color || null,
      size: link.size || null,
      content: link.content || null,
      textItems: link.text_items ? (() => {
        try {
          return JSON.parse(link.text_items);
        } catch {
          return null;
        }
      })() : null,
      sortOrder: link.sort_order,
      isActive: link.is_active !== 0,
      clickCount: link.click_count || 0,
      ctaAction: link.cta_action || null,
      ctaClicks: link.cta_click_count || 0,
      status: normalizeLinkStatus(link.status),
      campaignName: link.campaign_name || null,
      startDate: link.start_date || null,
      startTime: link.start_time || null,
      endDate: link.end_date || null,
      endTime: link.end_time || null,
      timezone: link.timezone || null,
      availability: link.availability === 'unavailable' ? 'unavailable' : 'available',
      coverImage: link.cover_image || null,
      coverImageAlt: link.cover_image_alt || null,
    }));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="links-export.json"');
    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    res.status(500).json({ error: 'Failed to export links' });
  }
});

// Import links from JSON
app.post('/api/links/import', authenticateToken, requirePermission('links:write'), async (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Invalid payload: expected an array' });
  }

  try {
    // Validate the incoming data against our schema
    const validationResult = LinksPayloadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid link data',
        details: validationResult.error
      });
    }

    const links = validationResult.data;

    await withTransaction(async () => {
      // Clear existing links
      await dbRun('DELETE FROM links');

      // Insert new links, preserving all fields including analytics and scheduling
      for (const [index, link] of links.entries()) {
        await dbRun(
          `INSERT INTO links (
            id, title, description, url, hide_url, type, icon, icon_type,
            background_color, text_color, size, content,
            title_font_family, description_font_family,
            text_alignment, title_font_size, description_font_size,
            text_items, sort_order, is_active,
            click_count, cta_action, cta_click_count, status, campaign_name, start_date, start_time, end_date, end_time, timezone,
            cover_image, cover_image_alt, availability
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            link.id || String(index + 1),
            link.title,
            link.description,
            link.url,
            link.hideUrl ? 1 : 0,
            link.type,
            link.icon,
            link.iconType,
            link.backgroundColor,
            link.textColor,
            link.size,
            link.content,
            link.titleFontFamily,
            link.descriptionFontFamily,
            link.alignment,
            link.titleFontSize || null,
            link.descriptionFontSize || null,
            link.textItems ? JSON.stringify(link.textItems) : null,
            link.sortOrder ?? index,
            link.isActive !== false ? 1 : 0,
            link.clickCount || 0,
            link.ctaAction || null,
            link.ctaClicks || 0,
            normalizeLinkStatus(link.status),
            link.campaignName || null,
            link.startDate || null,
            link.startTime || null,
            link.endDate || null,
            link.endTime || null,
            link.timezone || null,
            link.coverImage || null,
            link.coverImageAlt || null,
            link.availability === 'unavailable' ? 'unavailable' : 'available'
          ]
        );
      }
    });

    res.json({ success: true, count: links.length });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import links' });
  }
});


app.put('/api/links', authenticateToken, requirePermission('links:write'), async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an array of links.' });
    }

    const parseResult = LinksPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid links payload',
        details: parseResult.error.issues
      });
    }

    const links = parseResult.data;

    // Snapshot current click counts BEFORE deleting so analytics are never wiped.
    // Prefer the live DB value over the (potentially stale) frontend value.
    const existingRows = await dbAll('SELECT id, click_count, cta_click_count FROM links').catch(() => []);
    const savedClicks = new Map(existingRows.map(r => [String(r.id), r.click_count || 0]));
    const savedCtaClicks = new Map(existingRows.map(r => [String(r.id), r.cta_click_count || 0]));

    const result = await withTransaction(async () => {
      await dbRun('DELETE FROM links');

      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const linkId = typeof link.id === 'string' ? link.id : String(link.id);

        const iconValue = (link.icon && typeof link.icon === 'string' &&
          (link.icon.startsWith('data:image/') || link.icon.startsWith('blob:')))
          ? link.icon
          : (link.icon || null);

        const textItemsValue = Array.isArray(link.textItems)
          ? JSON.stringify(
              link.textItems.map((item) =>
                typeof item === 'string'
                  ? { text: item }
                  : { text: item.text, url: item.url || '', textColor: item.textColor || null, fontSize: item.fontSize || null, fontFamily: item.fontFamily || null }
              )
            )
          : null;

        // Use live DB click count if this link existed before the save; fall back
        // to the frontend value for brand-new links (no existing DB row).
        const clickCount = savedClicks.has(linkId)
          ? savedClicks.get(linkId)
          : (link.clickCount || 0);
        const ctaClicks = savedCtaClicks.has(linkId)
          ? savedCtaClicks.get(linkId)
          : (link.ctaClicks || 0);

        await dbRun(
          'INSERT INTO links (id, title, description, url, hide_url, icon, type, text_items, sort_order, is_active, background_color, text_color, size, icon_type, content, title_font_family, description_font_family, text_alignment, title_font_size, description_font_size, click_count, cta_action, cta_click_count, status, campaign_name, start_date, start_time, end_date, end_time, timezone, cover_image, cover_image_alt, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            linkId,
            link.title,
            link.description || '',
            link.url || '',
            link.hideUrl ? 1 : 0,
            iconValue,
            link.type || 'link',
            textItemsValue,
            i,
            link.isActive !== false ? 1 : 0,
            link.backgroundColor || null,
            link.textColor || null,
            link.size || null,
            link.iconType || (iconValue ? 'image' : null),
            link.content || null,
            link.titleFontFamily || null,
            link.descriptionFontFamily || null,
            link.alignment || null,
            link.titleFontSize || null,
            link.descriptionFontSize || null,
            clickCount,
            link.ctaAction || null,
            ctaClicks,
            normalizeLinkStatus(link.status),
            link.campaignName || null,
            link.startDate || null,
            link.startTime || null,
            link.endDate || null,
            link.endTime || null,
            link.timezone || null,
            link.coverImage || null,
            link.coverImageAlt || null,
            link.availability === 'unavailable' ? 'unavailable' : 'available'
          ]
        );
      }

      return { count: links.length };
    });

    res.json({ success: true, count: result.count });

  } catch (error) {
    console.error('Error updating links:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid links payload',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to save links',
      message: error.message
    });
  }
});

// Theme Routes
app.get('/api/theme', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const theme = await dbGet('SELECT * FROM theme_config ORDER BY id DESC LIMIT 1');
    
    if (!theme) {
      return res.json({ ...DEFAULT_THEME_PAYLOAD });
    }
    
    // If we have a full theme configuration stored, return it
    if (theme.full_config) {
      try {
        const fullConfig = JSON.parse(theme.full_config);
        return res.json(fullConfig);
      } catch (e) {
        // Fall back to basic config if JSON parsing fails
      }
    }
    
    // Return basic config for backward compatibility
    res.json({
      primary: theme.primary_color,
      background: theme.background_color,
      foreground: theme.text_color
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load theme' });
  }
});

const ThemeSurfaceSchema = z.object({
  background: z.string().max(100),
  backgroundSecondary: z.string().max(100),
  foreground: z.string().max(100),
  muted: z.string().max(100),
  border: z.string().max(100),
  accent: z.string().max(100),
  accentForeground: z.string().max(100).optional(),
  direction: z.string().max(100),
});

const ThemeSchema = z.object({
  primary: z.string().max(100).optional(),
  primaryGlow: z.string().max(100).optional(),
  background: z.string().max(100).optional(),
  backgroundSecondary: z.string().max(100).optional(),
  card: z.string().max(100).optional(),
  foreground: z.string().max(100).optional(),
  muted: z.string().max(100).optional(),
  accent: z.string().max(100).optional(),
  border: z.string().max(100).optional(),
  backgroundGradient: z.object({
    from: z.string().max(100).optional(),
    to: z.string().max(100).optional(),
    direction: z.string().max(100).optional(),
  }).optional(),
  cardGradient: z.object({
    from: z.string().max(100).optional(),
    to: z.string().max(100).optional(),
    direction: z.string().max(100).optional(),
  }).optional(),
  profileCard: ThemeSurfaceSchema.omit({ accentForeground: true }).optional(),
  contentCard: ThemeSurfaceSchema.optional(),
  contentCardMode: z.enum(['mono', 'multi']).optional(),
  contentCardVariants: z.array(ThemeSurfaceSchema).max(8).optional(),
  fontFamily: z.string().max(300).optional(),
  cardRadius: z.number().optional(),
  cardSpacing: z.number().optional(),
  maxWidth: z.string().max(50).optional(),
  glowIntensity: z.number().optional(),
  blurIntensity: z.number().optional(),
  content: z.object({
    profileName: z.string().max(200).optional(),
    profileBio: z.string().max(200).optional(),
    footerText: z.string().max(500).optional(),
    adminTitle: z.string().max(200).optional(),
  }).optional(),
  buttonStyle: z.string().max(50).optional(),
  linkStyle: z.string().max(50).optional(),
  customCSS: z.string().max(50_000).optional(),
  backgroundMedia: z.object({
    type: z.enum(['color', 'gradient', 'video', 'gif']).optional(),
    mediaUrl: z.string().max(500).optional().nullable(),
    opacity: z.number().min(0).max(1).optional(),
    blur: z.number().min(0).max(100).optional(),
    overlayColor: z.string().max(100).optional(),
    overlayOpacity: z.number().min(0).max(1).optional(),
    brightness: z.number().min(0).max(3).optional(),
    saturation: z.number().min(0).max(3).optional(),
    contrast: z.number().min(0).max(3).optional(),
    scale: z.number().min(1).max(4).optional(),
    objectFit: z.enum(['cover', 'contain', 'fill']).optional(),
    glassmorphism: z.boolean().optional(),
  }).optional(),
  // Allow any additional string/number/boolean theme keys (color values, sizes, etc.)
}).catchall(z.union([z.string().max(50_000), z.number(), z.boolean(), z.null()]));

app.put('/api/theme', authenticateToken, requirePermission('theme:write'), async (req, res) => {
  try {
    const parseResult = ThemeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid theme data', details: parseResult.error.issues });
    }

    const themeConfig = parseResult.data;

    // Extract basic colors for backward compatibility
    const primary = String(themeConfig.primary || '#007bff');
    const background = String(themeConfig.background || '#ffffff');
    const foreground = String(themeConfig.foreground || '#000000');

    // Check if theme exists
    const existing = await dbGet('SELECT id FROM theme_config LIMIT 1');

    if (existing) {
      await dbRun(
        'UPDATE theme_config SET primary_color = ?, background_color = ?, text_color = ?, full_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [primary, background, foreground, JSON.stringify(themeConfig), existing.id]
      );
    } else {
      await dbRun(
        'INSERT INTO theme_config (primary_color, background_color, text_color, full_config) VALUES (?, ?, ?, ?)',
        [primary, background, foreground, JSON.stringify(themeConfig)]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save theme' });
  }
});

const MAP_PREVIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const mapPreviewCache = new Map();

app.get('/api/map-preview', apiLimiter, async (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  if (!query || query.length > 300) {
    return res.status(400).json({ error: 'A valid map query is required' });
  }

  const cacheKey = query.toLocaleLowerCase('it');
  const cached = mapPreviewCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MAP_PREVIEW_CACHE_TTL_MS) {
    res.set('Cache-Control', 'public, max-age=86400');
    return res.json(cached.value);
  }

  try {
    const lookupUrl = new URL('https://nominatim.openstreetmap.org/search');
    lookupUrl.searchParams.set('format', 'jsonv2');
    lookupUrl.searchParams.set('limit', '1');
    lookupUrl.searchParams.set('accept-language', 'it');
    lookupUrl.searchParams.set('q', query);

    const response = await fetch(lookupUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: 'application/json',
        'User-Agent': `OrbitPage/${APP_VERSION} (map preview)`,
      },
    });
    if (!response.ok) {
      throw new Error(`Map provider returned ${response.status}`);
    }

    const results = await response.json();
    const result = Array.isArray(results) ? results[0] : null;
    if (!result?.lat || !result?.lon) {
      return res.status(404).json({ error: 'Map location not found' });
    }

    const value = {
      lat: String(result.lat),
      lon: String(result.lon),
      displayName: typeof result.display_name === 'string' ? result.display_name : query,
    };
    mapPreviewCache.set(cacheKey, { timestamp: Date.now(), value });
    res.set('Cache-Control', 'public, max-age=86400');
    return res.json(value);
  } catch (error) {
    console.error('Map preview lookup failed:', error?.message || error);
    return res.status(502).json({ error: 'Map preview is temporarily unavailable' });
  }
});

// Utility Routes
app.get('/api/generate-password', (req, res) => {
  const password = generateSecurePassword();
  res.json({ password });
});

app.post('/api/validate-password', (req, res) => {
  const { password } = req.body;
  const isStrong = isPasswordStrong(password);
  res.json({ isStrong });
});

// User management routes
app.get('/api/users', authenticateToken, requirePermission('users:manage'), async (req, res) => {
  try {
    const users = await dbAll('SELECT username, role, created_at FROM admin_users ORDER BY username');
    res.json(users);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

app.post('/api/users', authenticateToken, requirePermission('users:manage'), async (req, res) => {
  try {
    const { username, password, role } = CreateUserBodySchema.parse(req.body || {});
    if (!isPasswordStrong(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' });
    }
    const existing = await dbGet('SELECT username FROM admin_users WHERE username = ?', [username]);
    if (existing) return res.status(409).json({ error: 'Username already exists' });
    const validRole = role;
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    await dbRun('INSERT INTO admin_users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)', [username, passwordHash, salt, validRole]);
    res.status(201).json({ success: true, username, role: validRole });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    if (validationMessage) return res.status(400).json({ error: validationMessage });
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:username', authenticateToken, async (req, res) => {
  if (DEMO_MODE) return res.status(403).json({ error: 'Disabled in demo mode.' });
  try {
    const { username } = req.params;
    const { password } = UpdateUserPasswordBodySchema.parse(req.body || {});
    // Only allow users to change their own password, or users with users:manage permission
    const isSelf = req.user.username === username;
    const canManage = (req.user.permissions || []).includes('users:manage');
    if (!isSelf && !canManage) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (!isPasswordStrong(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' });
    }
    const user = await dbGet('SELECT username FROM admin_users WHERE username = ?', [username]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    await dbRun('UPDATE admin_users SET password_hash = ?, salt = ?, auth_version = COALESCE(auth_version, 0) + 1 WHERE username = ?', [passwordHash, salt, username]);
    // Issue a fresh token if the user is changing their own password
    const updatedUser = await dbGet('SELECT auth_version FROM admin_users WHERE username = ?', [username]);
    const newToken = req.user.username === username ? generateToken(username, Number(updatedUser?.auth_version || 0)) : undefined;
    res.json({ success: true, ...(newToken ? { token: newToken } : {}) });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    if (validationMessage) return res.status(400).json({ error: validationMessage });
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:username', authenticateToken, requirePermission('users:manage'), async (req, res) => {
  if (DEMO_MODE) return res.status(403).json({ error: 'Disabled in demo mode.' });
  try {
    const { username } = req.params;
    if (username === 'admin') return res.status(403).json({ error: 'The admin user cannot be deleted' });
    const user = await dbGet('SELECT username FROM admin_users WHERE username = ?', [username]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await dbRun('DELETE FROM admin_users WHERE username = ?', [username]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update a user's role (admin/users:manage only; cannot change the 'admin' user's role)
app.patch('/api/users/:username/role', authenticateToken, requirePermission('users:manage'), async (req, res) => {
  if (DEMO_MODE) return res.status(403).json({ error: 'Disabled in demo mode.' });
  try {
    const { username } = req.params;
    if (username === 'admin') return res.status(403).json({ error: 'Cannot change the role of the admin user' });
    const { role } = UpdateRoleBodySchema.parse(req.body || {});
    const user = await dbGet('SELECT username FROM admin_users WHERE username = ?', [username]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await dbRun('UPDATE admin_users SET role = ? WHERE username = ?', [role, username]);
    res.json({ success: true, username, role });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    if (validationMessage) return res.status(400).json({ error: validationMessage });
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// PATCH /api/links/:id/style — update visual style fields only (links:style or links:write)
app.patch('/api/links/:id/style', authenticateToken, requireAnyPermission('links:style', 'links:write'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) return res.status(400).json({ error: 'Invalid id' });
    const colMap = {
      backgroundColor:      'background_color',
      textColor:            'text_color',
      titleFontFamily:      'title_font_family',
      descriptionFontFamily:'description_font_family',
      alignment:            'text_alignment',
      titleFontSize:        'title_font_size',
      descriptionFontSize:  'description_font_size',
      size:                 'size',
    };
    const fields = [];
    const values = [];
    for (const [key, col] of Object.entries(colMap)) {
      if (req.body[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(req.body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid style fields provided' });
    const existing = await dbGet('SELECT id FROM links WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Link not found' });
    values.push(id);
    await dbRun(`UPDATE links SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
    res.json({ success: true });
  } catch (error) {
    console.error('Error patching link style:', error);
    res.status(500).json({ error: 'Failed to update link style' });
  }
});

// PATCH /api/links/:id/icon — update icon/cover-image fields only (links:images or links:write)
app.patch('/api/links/:id/icon', authenticateToken, requireAnyPermission('links:images', 'links:write'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) return res.status(400).json({ error: 'Invalid id' });
    const colMap = {
      icon:          'icon',
      iconType:      'icon_type',
      coverImage:    'cover_image',
      coverImageAlt: 'cover_image_alt',
    };
    const fields = [];
    const values = [];
    for (const [key, col] of Object.entries(colMap)) {
      if (req.body[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(req.body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid icon fields provided' });
    const existing = await dbGet('SELECT id FROM links WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Link not found' });
    values.push(id);
    await dbRun(`UPDATE links SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
    res.json({ success: true });
  } catch (error) {
    console.error('Error patching link icon:', error);
    res.status(500).json({ error: 'Failed to update link icon' });
  }
});

app.post('/api/auth/change-password', authLimiter, authenticateToken, async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Change password is disabled in demo mode.' });
  }

  try {
    const { currentPassword, newPassword } = ChangePasswordBodySchema.parse(req.body || {});

    // Get current user (the one making the request)
    const callerUsername = req.user.username;
    const user = await dbGet(
      'SELECT username, password_hash, salt, auth_version FROM admin_users WHERE username = ?',
      [callerUsername]
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Verify current password using constant-time comparison
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Enforce strong password
    if (!isPasswordStrong(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
      });
    }

    // Hash new password with new salt
    const newSalt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, newSalt);

    // Update database
    await dbRun(
      'UPDATE admin_users SET password_hash = ?, salt = ?, auth_version = COALESCE(auth_version, 0) + 1 WHERE username = ?',
      [newHash, newSalt, callerUsername]
    );

    // Issue a fresh token
    const token = generateToken(callerUsername, Number(user.auth_version || 0) + 1);

    return res.json({ success: true, message: 'Password changed successfully', token });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    if (validationMessage) return res.status(400).json({ success: false, error: validationMessage });
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

// Password reset via RESET_TOKEN env var
app.post('/api/auth/reset-via-token', resetLimiter, async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Password reset is disabled in demo mode.' });
  }

  try {
    const { token, newPassword } = ResetViaTokenBodySchema.parse(req.body || {});
    const resetToken = process.env.RESET_TOKEN;

    if (!resetToken) {
      return res.status(400).json({ success: false, error: 'RESET_TOKEN is not configured on this server. Set the RESET_TOKEN environment variable to enable token-based password reset.' });
    }

    // Constant-time comparison to prevent timing attacks
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(resetToken);
    const valid = tokenBuf.length === secretBuf.length && timingSafeEqual(tokenBuf, secretBuf);

    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid reset token' });
    }

    if (!newPassword || !isPasswordStrong(newPassword)) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters with uppercase, lowercase, number, and special character' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await dbRun(
      'UPDATE admin_users SET password_hash = ?, salt = ?, totp_secret = NULL, totp_enabled = 0, totp_pending_expires_at = NULL, recovery_codes = NULL, auth_version = COALESCE(auth_version, 0) + 1 WHERE username = ?',
      [passwordHash, salt, 'admin']
    );

    res.json({ success: true, message: 'Password and two-factor authentication reset successfully. You can now log in and configure a new authenticator.' });
  } catch (error) {
    const validationMessage = getZodErrorMessage(error);
    if (validationMessage) return res.status(400).json({ success: false, error: validationMessage });
    console.error('Reset-via-token error:', error);
    res.status(500).json({ success: false, error: 'Password reset failed' });
  }
});

// Internal function to reset the application (used by both endpoints)
const resetApplicationData = async () => {
  // Start a transaction to ensure all or nothing
  await dbRun('BEGIN TRANSACTION');
  
  try {
    console.log('Starting application reset...');
    
    // Get list of all tables
    const tables = await dbAll(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'"
    );
    
    // Disable foreign key constraints temporarily
    await dbRun('PRAGMA foreign_keys = OFF');
    
    // Clear all data from all tables
    for (const table of tables) {
      try {
        console.log(`Clearing table: ${table.name}`);
        await dbRun(`DELETE FROM ${table.name}`);
      } catch (error) {
        console.warn(`Could not clear table ${table.name}:`, error.message);
      }
    }
    
    // Re-enable foreign key constraints
    await dbRun('PRAGMA foreign_keys = ON');
    
    // Reset SQLite sequences
    try {
      const sequences = await dbAll(
        "SELECT name FROM sqlite_sequence"
      );
      
      for (const seq of sequences) {
        await dbRun(`DELETE FROM sqlite_sequence WHERE name = '${seq.name}'`);
      }
    } catch (error) {
      console.warn('Could not reset SQLite sequences:', error.message);
    }
    
    // Insert default theme
    console.log('Setting up default theme...');
    await dbRun(`
      INSERT OR REPLACE INTO theme_config (id, primary_color, background_color, text_color, button_style, full_config)
      VALUES (1, ?, ?, ?, ?, ?)
    `, [
      '#007bff', 
      '#ffffff', 
      '#000000', 
      'rounded',
      JSON.stringify({
        primaryColor: '#007bff',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        buttonStyle: 'rounded',
        fontFamily: 'Inter, system-ui, sans-serif',
        linkStyle: 'card',
        customCSS: ''
      })
    ]);
    
    // Insert empty profile so the public page shows nothing until the admin fills it in
    console.log('Setting up default profile...');
    await dbRun(`
      INSERT OR REPLACE INTO profile_data (id, name, bio, avatar, social_links, show_avatar)
      VALUES (1, '', '', '', '{}', 1)
    `);
    
    // Commit the transaction
    await dbRun('COMMIT');
    
    console.log('Application reset completed successfully');
    
    return { 
      success: true, 
      message: 'Application reset successful. All data has been cleared and default settings have been restored.'
    };
    
  } catch (error) {
    // Rollback in case of any error
    console.error('Error in resetApplicationData:', error);
    try {
      await dbRun('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during transaction rollback:', rollbackError);
    }
    throw error;
  }
};

// Reset authentication - clear ALL data and reset to initial state (requires authentication)
app.post('/api/auth/reset', authenticateToken, resetLimiter, async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Application reset is disabled in demo mode.' });
  }

  try {
    console.log('Authenticated reset endpoint called by user:', req.user?.username || 'unknown');

    const result = await resetApplicationData();
    
    // Clear the auth token from the response
    res.clearCookie('token');
    
    res.json({
      ...result,
      success: true,
      message: 'Application reset successful. You will be redirected to the setup page.'
    });
  } catch (error) {
    console.error('Error in authenticated reset:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset application. ' + (error.message || 'Please try again.') 
    });
  }
});

// Special unauthenticated reset endpoint (for when you're locked out)
app.post('/api/auth/force-reset', resetLimiter, async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Force reset is disabled in demo mode.' });
  }

  try {
    console.log('Force reset endpoint called');

    // Verify reset token from environment variable or header
    const resetToken = process.env.RESET_TOKEN;
    const providedToken = req.headers['x-reset-token'];

    if (!resetToken || typeof resetToken !== 'string' || resetToken.length < 32) {
      console.warn('Force reset disabled: strong RESET_TOKEN env var not set');
      return res.status(403).json({ success: false, error: 'Unauthorized: Reset disabled' });
    }

    if (!providedToken || typeof providedToken !== 'string') {
      console.log('Invalid or missing reset token');
      return res.status(403).json({ success: false, error: 'Unauthorized: Invalid reset token' });
    }

    // Constant-time comparison
    const a = Buffer.from(providedToken);
    const b = Buffer.from(resetToken);
    const match = a.length === b.length && timingSafeEqual(a, b);

    if (!match) {
      console.log('Invalid or missing reset token');
      return res.status(403).json({ success: false, error: 'Unauthorized: Invalid reset token' });
    }
    
    console.log('Resetting application data...');
    const result = await resetApplicationData();
    
    console.log('Reset successful, sending response');
    res.json({
      ...result,
      success: true,
      message: 'Application reset successful. You can now set up a new admin account.'
    });
  } catch (error) {
    console.error('Error in force reset:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset application. ' + (error.message || 'Please try again.') 
    });
  }
});

app.get('/api/admin/backup', authenticateToken, requirePermission('users:manage'), async (req, res) => {
  try {
    const requestedSections = typeof req.query.sections === 'string'
      ? req.query.sections.split(',').map((section) => section.trim()).filter(Boolean)
      : undefined;
    const backupOptions = {
      appVersion: APP_VERSION,
      dbAll,
      uploadsPath,
    };
    if (requestedSections) backupOptions.sections = requestedSections;
    const backup = await createApplicationBackup(backupOptions);
    const date = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Disposition', `attachment; filename="orbitpage-backup-${date}.json"`);
    res.json(backup);
  } catch (error) {
    console.error('Backup export error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.post('/api/admin/restore', authenticateToken, requirePermission('users:manage'), async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Backup restore is disabled in demo mode.' });
  }

  try {
    const isSelectiveRequest = req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&
      Object.prototype.hasOwnProperty.call(req.body, 'backup');
    const backup = isSelectiveRequest ? req.body.backup : req.body;
    const requestedSections = isSelectiveRequest ? req.body.sections : undefined;
    await withTransaction(async () => {
      const restoreOptions = {
        backup,
        dbRun,
        uploadsPath,
      };
      if (requestedSections !== undefined) restoreOptions.sections = requestedSections;
      await restoreApplicationBackup(restoreOptions);
    });

    res.json({ success: true, message: 'Backup restored successfully.' });
  } catch (error) {
    console.error('Backup restore error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to restore backup',
    });
  }
});

// Serve React app for all other routes

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
    cb(null, uploadsPath);
  },
  filename: function (req, file, cb) {
    cb(null, createUploadFilename('img', file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept raster images only — SVG is excluded because it can carry embedded scripts (XSS)
    const allowedExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedExtensions.test(file.originalname) || !allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only raster image files (jpg, png, gif, webp) are allowed'), false);
    }
    cb(null, true);
  }
});

// File upload endpoint
app.post('/api/upload', authenticateToken, requireAnyPermission('profile:write', 'links:write', 'links:images', 'theme:write'), upload.single('file'), async (req, res) => {
  try {
    console.log('Upload request received. Files:', req.files);
    console.log('Request body:', req.body);
    
    if (!req.file) {
      console.error('No file received in upload. Check if the field name is correct (should be "file")');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      encoding: req.file.encoding
    };
    
    console.log('File uploaded successfully:', fileInfo.filename, fileInfo.size, 'bytes');

    // Validate that the resolved file path stays within the uploads directory
    // (defense-in-depth: multer already controls the path, but we verify explicitly)
    const resolvedFilePath = path.resolve(req.file.path);
    const resolvedUploadsDir = path.resolve(uploadsPath);
    if (!resolvedFilePath.startsWith(resolvedUploadsDir + path.sep)) {
      return res.status(500).json({ error: 'File path validation failed' });
    }

    // Verify file exists
    if (!fs.existsSync(resolvedFilePath)) {
      console.error('File was not saved to disk. Expected at:', resolvedFilePath);
      console.error('Current working directory:', process.cwd());
      return res.status(500).json({
        error: 'Failed to save file',
        details: 'The file was not saved to the expected location.'
      });
    }

    try {
      enforceUploadStorageQuota({
        uploadsPath,
        filePath: resolvedFilePath,
        quotaBytes: uploadStorageQuotaBytes,
      });
    } catch (error) {
      if (error instanceof UploadQuotaExceededError) {
        console.warn('Upload rejected because storage quota was exceeded:', {
          quotaBytes: error.quotaBytes,
          totalBytes: error.totalBytes,
        });
        return res.status(413).json({
          error: 'Upload storage quota exceeded',
          quotaBytes: error.quotaBytes,
          totalBytes: error.totalBytes,
        });
      }
      throw error;
    }

    // Set file permissions (Windows compatible)
    try {
      fs.chmodSync(resolvedFilePath, UPLOAD_FILE_MODE);
      console.log('File permissions set successfully');
    } catch (err) {
      console.warn('Could not set file permissions:', err.message);
    }

    // Get the URL to access the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    
    // Verify the URL is accessible
    const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;
    console.log('File available at:', fullUrl);
    
    res.json({ 
      success: true, 
      filePath: fileUrl,
      fullUrl: fullUrl,
      fileName: req.file.filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Background media upload (video/gif) — separate multer instance with higher limit
const bgStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
    cb(null, uploadsPath);
  },
  filename: function (req, file, cb) {
    cb(null, createUploadFilename('bg', file.originalname));
  }
});

const bgUpload = multer({
  storage: bgStorage,
  limits: { fileSize: videoUploadLimitBytes },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(mp4|webm|gif)$/i;
    const allowedMimeTypes = ['video/mp4', 'video/webm', 'image/gif'];
    if (!allowedExtensions.test(file.originalname) || !allowedMimeTypes.includes(file.mimetype)) {
      const error = new Error('Only MP4, WebM, and GIF files with matching extensions are allowed');
      error.statusCode = 415;
      return cb(error, false);
    }
    cb(null, true);
  }
});

const handleMediaUpload = async (req, res) => {
  let resolvedFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    resolvedFilePath = path.resolve(req.file.path);
    const resolvedUploadsDir = path.resolve(uploadsPath);
    if (!resolvedFilePath.startsWith(resolvedUploadsDir + path.sep)) {
      return res.status(500).json({ error: 'File path validation failed' });
    }

    if (!fs.existsSync(resolvedFilePath)) {
      return res.status(500).json({ error: 'Failed to save file' });
    }

    assertUploadedMediaSignature({ filePath: resolvedFilePath, contentType: req.file.mimetype });

    try {
      enforceUploadStorageQuota({
        uploadsPath,
        filePath: resolvedFilePath,
        quotaBytes: uploadStorageQuotaBytes,
      });
    } catch (error) {
      if (error instanceof UploadQuotaExceededError) {
        console.warn('Background upload rejected because storage quota was exceeded:', {
          quotaBytes: error.quotaBytes,
          totalBytes: error.totalBytes,
        });
        return res.status(413).json({
          error: 'Upload storage quota exceeded',
          quotaBytes: error.quotaBytes,
          totalBytes: error.totalBytes,
        });
      }
      throw error;
    }

    try { fs.chmodSync(resolvedFilePath, UPLOAD_FILE_MODE); } catch { /* Windows may not support chmod */ }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;
    console.log('Background media uploaded:', req.file.filename, req.file.size, 'bytes');

    res.json({ success: true, filePath: fileUrl, fullUrl, fileName: req.file.filename });
  } catch (error) {
    if (resolvedFilePath) fs.rmSync(resolvedFilePath, { force: true });
    console.error('Background upload error:', error);
    res.status(400).json({ error: error.message || 'Failed to upload media' });
  }
};

app.post('/api/upload/background', authenticateToken, requirePermission('theme:write'), bgUpload.single('file'), handleMediaUpload);
app.post('/api/upload/video', authenticateToken, requireAnyPermission('links:write', 'links:images'), bgUpload.single('file'), handleMediaUpload);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: err.code === 'LIMIT_FILE_SIZE'
        ? `Video files must be ${Math.round(videoUploadLimitBytes / (1024 * 1024))} MB or smaller.`
        : err.message,
    });
  } else if (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || 'File upload failed' });
  }
  next();
});

// Health check endpoint — available at both /health (external scripts)
// and /api/health (frontend api-client which prepends /api to every call)
const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    version: APP_VERSION,
    demoMode: DEMO_MODE,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    node: process.version,
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ============================================================
// CONSENT CONFIG ROUTES
// ============================================================

/**
 * Default consent configuration returned when no row exists in the DB.
 * Hardcoded mode is disabled by default — the admin must explicitly enable it.
 */
const DEFAULT_CONSENT_CONFIG = {
  legalPolicies: {
    showFooterLinks: false,
    privacyPolicy: {
      mode: 'external',
      externalUrl: '',
      hostedText: '',
      hostedFileName: '',
      embeddedCode: '',
    },
    cookiePolicy: {
      mode: 'external',
      externalUrl: '',
      hostedText: '',
      hostedFileName: '',
      embeddedCode: '',
    },
  },
  hardcoded: {
    policyVersion: '1.0',
    texts: {
      title: 'We value your privacy',
      description:
        'We use cookies to improve your experience, analyse traffic, and provide personalised content. You can choose which categories to allow or reject all optional cookies.',
      acceptAll: 'Accept all',
      rejectAll: 'Reject all',
      managePreferences: 'Manage preferences',
      savePreferences: 'Save preferences',
      reopenLabel: 'Cookie preferences',
      privacyPolicyLinkText: 'Privacy policy',
      cookiePolicyLinkText: 'Cookie policy',
    },
    urls: { privacyPolicy: '', cookiePolicy: '' },
    categories: {
      preferences: {
        enabled: false,
        title: 'Preferences',
        description:
          'These cookies remember your choices and personalise your experience, such as language or region preferences.',
      },
      analytics: {
        enabled: true,
        title: 'Analytics',
        description:
          'These cookies help us understand how visitors interact with the site by collecting and reporting information anonymously (e.g. Google Analytics).',
      },
      marketing: {
        enabled: false,
        title: 'Marketing',
        description:
          'These cookies track your online activity to help advertisers deliver more relevant advertising or to limit how many times you see an ad.',
      },
    },
    layout: 'bottom-bar',
    theme: 'auto',
    buttonPriority: 'equal',
    geoMode: 'eu-only',
    consentExpiryDays: 365,
    reshowOnVersionChange: true,
    legalFooterText: '',
  },
  builder: {
    provider: 'custom',
    providerConfig: {
      siteId: '',
      cookiePolicyId: '',
      scriptId: '',
      headSnippet: '',
      bodySnippet: '',
      privacyPolicyUrl: '',
      cookiePolicyUrl: '',
    },
    reopenSelector: '',
  },
};

const DEMO_CONSENT_CONFIG = {
  ...DEFAULT_CONSENT_CONFIG,
  legalPolicies: {
    showFooterLinks: true,
    privacyPolicy: {
      mode: 'embedded',
      externalUrl: '',
      hostedText: '',
      hostedFileName: '',
      embeddedCode: DEMO_PRIVACY_POLICY_EMBED,
    },
    cookiePolicy: {
      mode: 'embedded',
      externalUrl: '',
      hostedText: '',
      hostedFileName: '',
      embeddedCode: DEMO_COOKIE_POLICY_EMBED,
    },
  },
  builder: {
    ...DEFAULT_CONSENT_CONFIG.builder,
    provider: 'custom',
    providerConfig: {
      ...DEFAULT_CONSENT_CONFIG.builder.providerConfig,
      headSnippet: DEMO_CMP_SCRIPT,
    },
    reopenSelector: '',
  },
};

/**
 * Validate consent config payload and return domain-level errors
 * (e.g. "enabled but no policy URL") that Zod's type-level schema can't catch.
 */
const validateConsentConfigDomain = (config, legalUrls = {}) => {
  const errors = [];

  if (config.mode === 'hardcoded' && config.enabled) {
    const { categories = {} } = config.hardcoded || {};
    if (!legalUrls.privacyPolicyUrl && !legalUrls.cookiePolicyUrl) {
      errors.push('At least one policy URL must be configured in Admin > Privacy > Legal policies when the native banner is enabled.');
    }
    for (const [key, cat] of Object.entries(categories)) {
      if (cat.enabled && !cat.description?.trim()) {
        errors.push(`The "${key}" category must have a description when it is enabled.`);
      }
    }
  }

  if (config.mode === 'builder' && config.enabled) {
    const { providerConfig = {} } = config.builder || {};
    if (!providerConfig.headSnippet?.trim()) {
      errors.push('Paste your external CMP script before enabling external consent management.');
    }
  }

  return errors;
};

// GET /api/consent-config/public — unauthenticated, used by the public page at runtime
app.get('/api/consent-config/public', apiLimiter, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (DEMO_MODE) {
      return res.json({
        success: true,
        data: {
          mode: 'builder',
          enabled: true,
          ...applyProfileLegalUrlsToConsentConfig(DEMO_CONSENT_CONFIG, DEMO_LEGAL_URLS),
        },
      });
    }

    const row = await dbGet(
      'SELECT mode, enabled, full_config FROM cookie_consent_config ORDER BY id DESC LIMIT 1'
    );
    const legalUrls = await getProfileLegalUrls();
    if (!row || !row.enabled) {
      const config = row ? safeJsonParse(row.full_config, {}) : DEFAULT_CONSENT_CONFIG;
      return res.json({
        success: true,
        data: {
          mode: 'disabled',
          enabled: false,
          ...applyProfileLegalUrlsToConsentConfig(config, legalUrls),
        },
      });
    }
    const config = safeJsonParse(row.full_config, {});
    return res.json({
      success: true,
      data: {
        mode: row.mode,
        enabled: true,
        ...applyProfileLegalUrlsToConsentConfig(config, legalUrls),
      },
    });
  } catch (err) {
    console.error('Error fetching public consent config:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/consent-config — admin, returns full config including timestamps
app.get('/api/consent-config', authenticateToken, apiLimiter, async (req, res) => {
  try {
    if (DEMO_MODE) {
      return res.json({
        success: true,
        data: {
          mode: 'builder',
          enabled: true,
          ...applyProfileLegalUrlsToConsentConfig(DEMO_CONSENT_CONFIG, DEMO_LEGAL_URLS),
          createdAt: null,
          updatedAt: null,
        },
      });
    }

    const row = await dbGet(
      'SELECT * FROM cookie_consent_config ORDER BY id DESC LIMIT 1'
    );
    if (!row) {
      const legalUrls = await getProfileLegalUrls();
      return res.json({
        success: true,
        data: {
          mode: 'disabled',
          enabled: false,
          ...applyProfileLegalUrlsToConsentConfig(DEFAULT_CONSENT_CONFIG, legalUrls),
          createdAt: null,
          updatedAt: null,
        },
      });
    }
    const config = safeJsonParse(row.full_config, {});
    const legalUrls = await getProfileLegalUrls();
    return res.json({
      success: true,
      data: {
        id: row.id,
        mode: row.mode,
        enabled: Boolean(row.enabled),
        ...applyProfileLegalUrlsToConsentConfig(config, legalUrls),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('Error fetching consent config:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/consent-config — requires compliance:write
app.put('/api/consent-config', authenticateToken, apiLimiter, requirePermission('compliance:write'), async (req, res) => {
  if (DEMO_MODE) {
    return res.status(403).json({ success: false, error: 'Config changes are disabled in demo mode.' });
  }

  const parsed = ConsentConfigBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return res.status(400).json({ success: false, error: `Validation error — ${msgs}` });
  }

  const { mode, enabled, legalPolicies, hardcoded, builder } = parsed.data;

  try {
    const legalUrls = await getProfileLegalUrls();
    const domainErrors = validateConsentConfigDomain(parsed.data, legalUrls);
    if (domainErrors.length > 0) {
      return res.status(400).json({ success: false, error: domainErrors.join(' ') });
    }

    const fullConfig = JSON.stringify(stripDuplicateLegalUrlsFromConsentConfig({ legalPolicies, hardcoded, builder }));
    const existing = await dbGet(
      'SELECT id FROM cookie_consent_config ORDER BY id DESC LIMIT 1'
    );
    if (existing) {
      await dbRun(
        'UPDATE cookie_consent_config SET mode = ?, enabled = ?, full_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [mode, enabled ? 1 : 0, fullConfig, existing.id]
      );
    } else {
      await dbRun(
        'INSERT INTO cookie_consent_config (mode, enabled, full_config) VALUES (?, ?, ?)',
        [mode, enabled ? 1 : 0, fullConfig]
      );
    }
    return res.json({ success: true, message: 'Consent configuration saved successfully.' });
  } catch (err) {
    console.error('Error saving consent config:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Catch-all route for SPA
app.get('*', spaLimiter, async (req, res) => {
  console.log(`SPA catch-all serving index.html for: ${req.path}`);
  let isConfiguredSubpage = false;
  let isConfiguredPrimaryPage = false;
  if (/^\/[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(req.path)) {
    try {
      const slug = req.path.slice(1);
      const [subpages, pageSlug] = await Promise.all([getSubpagesPayload(), getInstancePageSlug()]);
      isConfiguredPrimaryPage = pageSlug === slug;
      isConfiguredSubpage = subpages.some((page) => page.enabled && page.slug === slug);
    } catch {
      isConfiguredSubpage = false;
      isConfiguredPrimaryPage = false;
    }
  }
  const statusCode = PUBLIC_SPA_ROUTES.has(req.path) || isAdminSpaRoute(req.path) || isConfiguredPrimaryPage || isConfiguredSubpage ? 200 : 404;
  serveSpaIndex(req, res, { statusCode });
});

app.get('/api/admin/media/cleanup', authenticateToken, requirePermission('users:manage'), async (req, res) => {
  try {
    res.json(await cleanupUnusedMedia({ dbAll, uploadsPath, dryRun: true, graceMs: mediaCleanupGraceMs() }));
  } catch (error) {
    console.error('Unused media preview error:', error);
    res.status(500).json({ error: 'Failed to inspect uploaded media.' });
  }
});

app.post('/api/admin/media/cleanup', authenticateToken, requirePermission('users:manage'), async (req, res) => {
  if (DEMO_MODE) return res.status(403).json({ error: 'Media cleanup is disabled in demo mode.' });
  try {
    res.json(await cleanupUnusedMedia({ dbAll, uploadsPath, dryRun: false, graceMs: mediaCleanupGraceMs() }));
  } catch (error) {
    console.error('Unused media cleanup error:', error);
    res.status(500).json({ error: 'Failed to clean uploaded media.' });
  }
});

export { app, stripStaticSeoTags, buildStructuredData, renderSeoTags };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`HTTP server running on port ${PORT}`);
  if (IS_PRODUCTION) {
    console.log(`Production mode: Frontend and API served from same origin`);
    console.log(`Access your OrbitPage instance at: http://your-domain:${PORT}`);
  } else {
    console.log(`Frontend: ${FRONTEND_URL}`);
    console.log(`API: ${FRONTEND_URL}/api`);
  }
  console.log('Rate limiting active:');
  console.log('- Global API: 300 requests/15min per IP');
  console.log('- Auth endpoints: 30 requests/15min per IP');
  console.log('- Login attempts: 5 failed/10min per IP');
  console.log('- Force reset: 2 requests/hour per IP');
  console.log('Trust proxy:', app.get('trust proxy') ? 'Enabled' : 'Disabled');

  if (ENABLE_HTTPS) {
    try {
      const mod = await import('selfsigned');
      const selfsigned = mod.default || mod;
      const attrs = [{ name: 'commonName', value: 'localhost' }];
      const pems = selfsigned.generate(attrs, {
        days: 365,
        keySize: 2048,
        algorithm: 'sha256'
      });

      const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);
      httpsServer.listen(SSL_PORT, '0.0.0.0', () => {
        console.log(`HTTPS server running on port ${SSL_PORT}`);
        console.log('HTTPS: Enabled (self-signed certificate)');
      });
      httpsServer.on('error', (err) => {
        console.error('HTTPS server error:', err?.message || err);
      });
    } catch (err) {
      console.error('Failed to start HTTPS server (self-signed):', err?.message || err);
      console.log('HTTPS: Disabled due to error');
    }
  } else {
    console.log('HTTPS: Disabled');
  }
});
}


