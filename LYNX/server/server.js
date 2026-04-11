import express from 'express';
import https from 'https';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import { initializeDatabase, dbGet, dbAll, dbRun, withTransaction } from './database.js';
import {
  isFirstTimeSetup,
  setupInitialCredentials,
  authenticateUser,
  generateToken,
  verifyToken,
  authenticateToken,
  isPasswordStrong,
  generateSecurePassword
} from './auth.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { version: APP_VERSION } = JSON.parse(fs.readFileSync(join(__dirname, 'package.json'), 'utf8'));

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
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
// Ensure correct client IP detection when behind a proxy/load balancer
// This is important so express-rate-limit keys by the real client IP
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", FRONTEND_URL],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"]
    },
    reportOnly: false
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// Serve static files with proper path resolution
const distPath = join(__dirname, '../dist');
const uploadsPath = join(__dirname, 'uploads');

console.log('Serving static files from:', distPath);
console.log('Serving uploads from:', uploadsPath);

// Ensure uploads directory exists
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('Created uploads directory at:', uploadsPath);
}

// Serve static files from the dist directory
app.use(express.static(distPath));

// Serve uploaded files from the uploads directory
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=31536000');
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
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit each IP to 5 failed login attempts per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  message: {
    success: false,
    error: 'Too many failed login attempts. Please try again later.'
  }
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 2,
});

// Apply rate limiting
app.use('/api', apiLimiter);

// Initialize database
await initializeDatabase();

// Auth Routes
app.get('/api/auth/setup-status', authLimiter, async (req, res) => {
  try {
    const firstTime = await isFirstTimeSetup();
    res.json({ isFirstTimeSetup: firstTime });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

app.post('/api/auth/setup', authLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    await setupInitialCredentials(password);
    const token = generateToken('admin');
    
    res.json({ 
      success: true, 
      token,
      message: 'Admin account created successfully' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    console.log('Login attempt received');
    const isValid = await authenticateUser(password);
    
    if (!isValid) {
      console.log('Login failed: Invalid password');
      // Get the stored user to check what's in the database
      const user = await dbGet('SELECT * FROM admin_users WHERE username = ?', ['admin']);
      console.log('Stored user data:', user);
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    console.log('Login successful, generating token...');
    const token = generateToken('admin');
    console.log('Token generated. Length:', token?.length);
    res.json({ success: true, token });
    return;
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/verify', authLimiter, authenticateToken, async (req, res) => {
  try {
    // Get the full user data from database
    const user = await dbGet(
      'SELECT username FROM admin_users WHERE username = ?',
      [req.user.username]
    );
    
    if (!user) {
      return res.status(404).json({ valid: false, error: 'User not found' });
    }
    
    res.json({ 
      valid: true, 
      user: { 
        username: user.username 
      } 
    });
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

// Profile Routes
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
        tab_title: undefined,
        meta_description: undefined,
        footer_text: undefined,
        favicon: undefined,
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
      tab_title: profile.tab_title || undefined,
      meta_description: profile.meta_description || undefined,
      footer_text: profile.footer_text || undefined,
      favicon: profile.favicon || undefined,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

const SocialLinksSchema = z.record(z.string().max(2048)).optional().default({});

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
}).strip();

app.put('/api/profile', authenticateToken, async (req, res) => {
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
    const socialLinks = body.socialLinks ?? body.social_links ?? {};
    const nameFontSize = body.nameFontSize ?? body.name_font_size ?? null;
    const bioFontSize = body.bioFontSize ?? body.bio_font_size ?? null;
    const tabTitle = body.tabTitle ?? body.tab_title ?? null;
    const metaDescription = body.metaDescription ?? body.meta_description ?? null;
    const footerText = body.footerText ?? body.footer_text ?? null;
    const favicon = body.favicon ?? null;
    const showAvatarRaw = body.showAvatar ?? body.show_avatar;
    const showAvatar = typeof showAvatarRaw === 'number' ? showAvatarRaw !== 0 : !!showAvatarRaw;

    // Check if profile exists
    const existing = await dbGet('SELECT id FROM profile_data LIMIT 1');

    if (existing) {
      await dbRun(
        'UPDATE profile_data SET name = ?, bio = ?, avatar = ?, social_links = ?, show_avatar = ?, name_font_size = ?, bio_font_size = ?, tab_title = ?, meta_description = ?, footer_text = ?, favicon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, bio, avatar, JSON.stringify(socialLinks || {}), showAvatar ? 1 : 0, nameFontSize, bioFontSize, tabTitle, metaDescription, footerText, favicon, existing.id]
      );
    } else {
      await dbRun(
        'INSERT INTO profile_data (name, bio, avatar, social_links, show_avatar, name_font_size, bio_font_size, tab_title, meta_description, footer_text, favicon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, bio, avatar, JSON.stringify(socialLinks || {}), showAvatar ? 1 : 0, nameFontSize, bioFontSize, tabTitle, metaDescription, footerText, favicon]
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
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      links = await dbAll(
        `SELECT * FROM links WHERE is_active = 1
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)
         ORDER BY sort_order`,
        [today, today]
      );
    }
    
    // Format links for response
    const formattedLinks = links.map(link => {
      // Check if icon is base64 data URL and ensure it's preserved
      const icon = link.icon && (link.icon.startsWith('data:image/') || link.icon.startsWith('blob:')) 
        ? link.icon 
        : link.icon || null;
        
      return {
        id: link.id,
        title: link.title,
        description: link.description || '',
        url: link.url || '',
        icon: icon,
        iconType: link.icon_type || (icon ? 'image' : undefined),
        // Provide content and parsed text items for text cards
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
        startDate: link.start_date || null,
        endDate: link.end_date || null,
        createdAt: link.created_at,
        updatedAt: link.updated_at
      };
    });
    
    res.json(formattedLinks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load links' });
  }
});

// Click tracking (public, no auth required)
app.post('/api/links/:id/click', apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    await dbRun('UPDATE links SET click_count = click_count + 1 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record click' });
  }
});

// Export links as JSON
app.get('/api/links/export', authenticateToken, async (req, res) => {
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
      isActive: link.is_active,
      clickCount: link.click_count || 0,
      startDate: link.start_date || null,
      endDate: link.end_date || null,
    }));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="links-export.json"');
    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    res.status(500).json({ error: 'Failed to export links' });
  }
});

// Import links from JSON
app.post('/api/links/import', authenticateToken, async (req, res) => {
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
            id, title, description, url, type, icon, icon_type,
            background_color, text_color, size, content,
            title_font_family, description_font_family,
            text_alignment, title_font_size, description_font_size,
            text_items, sort_order, is_active,
            click_count, start_date, end_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            link.id || String(index + 1),
            link.title,
            link.description,
            link.url,
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
            index,
            link.isActive !== false ? 1 : 0,
            link.clickCount || 0,
            link.startDate || null,
            link.endDate || null
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

// Define strict validation schema to avoid type confusion
// Define schema for link validation
const LinkSchema = z.object({
  id: z.union([z.string().min(1), z.number().int().nonnegative()]),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  url: z.string().max(5000).optional().default(''),
  // Accept any string: data:image/ base64, http(s)/blob URLs, or short emoji/text strings.
  // Previously the union rejected emojis and text icons because they matched none of the branches.
  icon: z.string().max(2000000).nullable().optional().default(null),
  type: z.string().min(1).max(50).optional().default('link'),
  iconType: z.union([
    z.string().max(50),
    z.object({
      type: z.string().max(50)
    }).transform(obj => obj.type)
  ]).nullable().optional(),
  textItems: z.array(
    z.union([
      z.string().max(1000),
      z.object({ 
        text: z.string().max(1000), 
        url: z.string().max(5000).optional(),
        textColor: z.string().max(100).nullable().optional(),
        fontSize: z.string().max(50).nullable().optional(),
        fontFamily: z.string().max(200).nullable().optional()
      })
    ])
  ).nullable().optional(),
  backgroundColor: z.string().max(100).nullable().optional(),
  textColor: z.string().max(100).nullable().optional(),
  // Allow optional per-link font size strings (e.g. '16px')
  titleFontSize: z.string().max(50).nullable().optional(),
  descriptionFontSize: z.string().max(50).nullable().optional(),
  titleFontFamily: z.string().max(200).nullable().optional(),
  descriptionFontFamily: z.string().max(200).nullable().optional(),
  alignment: z.enum(['left','center','right']).nullable().optional(),
  size: z.string().max(50).nullable().optional(),
  content: z.string().max(10000).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  startDate: z.string().max(10).nullable().optional(),
  endDate: z.string().max(10).nullable().optional(),
  // clickCount is preserved on import so analytics survive a round-trip export/import
  clickCount: z.number().int().nonnegative().nullable().optional(),
}).strip();

const LinksPayloadSchema = z.array(LinkSchema).max(200);

app.put('/api/links', authenticateToken, async (req, res) => {
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

    const result = await withTransaction(async () => {
      await dbRun('DELETE FROM links');

      for (let i = 0; i < links.length; i++) {
        const link = links[i];

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

        await dbRun(
          'INSERT INTO links (id, title, description, url, icon, type, text_items, sort_order, is_active, background_color, text_color, size, icon_type, content, title_font_family, description_font_family, text_alignment, title_font_size, description_font_size, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            typeof link.id === 'string' ? link.id : String(link.id),
            link.title,
            link.description || '',
            link.url || '',
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
            link.startDate || null,
            link.endDate || null
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
      return res.json({
        primary: '#007bff',
        background: '#ffffff',
        foreground: '#000000'
      });
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

const ThemeSchema = z.object({
  primary: z.string().max(100).optional(),
  background: z.string().max(100).optional(),
  foreground: z.string().max(100).optional(),
  fontFamily: z.string().max(300).optional(),
  buttonStyle: z.string().max(50).optional(),
  linkStyle: z.string().max(50).optional(),
  customCSS: z.string().max(50_000).optional(),
  // Allow any additional string/number/boolean theme keys (color values, sizes, etc.)
}).catchall(z.union([z.string().max(50_000), z.number(), z.boolean(), z.null()]));

app.put('/api/theme', authenticateToken, async (req, res) => {
  try {
    const parseResult = ThemeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid theme data', details: parseResult.error.issues });
    }

    const themeConfig = parseResult.data;

    // Extract basic colors for backward compatibility
    const primary = (themeConfig.primary as string) || '#007bff';
    const background = (themeConfig.background as string) || '#ffffff';
    const foreground = (themeConfig.foreground as string) || '#000000';

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

app.post('/api/auth/change-password', authLimiter, authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
    }

    // Get current admin user
    const user = await dbGet(
      'SELECT username, password_hash, salt FROM admin_users WHERE username = ?',
      ['admin']
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'Admin user not found' });
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
      'UPDATE admin_users SET password_hash = ?, salt = ?, created_at = created_at, updated_at = CURRENT_TIMESTAMP WHERE username = ?',
      [newHash, newSalt, 'admin']
    ).catch(async () => {
      // Fallback if updated_at column does not exist
      await dbRun(
        'UPDATE admin_users SET password_hash = ?, salt = ? WHERE username = ?',
        [newHash, newSalt, 'admin']
      );
    });

    // Issue a fresh token
    const token = generateToken('admin');

    return res.json({ success: true, message: 'Password changed successfully', token });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

// Password reset via RESET_TOKEN env var
app.post('/api/auth/reset-via-token', resetLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    const resetToken = process.env.RESET_TOKEN;

    if (!resetToken) {
      return res.status(400).json({ success: false, error: 'RESET_TOKEN is not configured on this server. Set the RESET_TOKEN environment variable to enable token-based password reset.' });
    }

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Reset token is required' });
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
      'UPDATE admin_users SET password_hash = ?, salt = ? WHERE username = ?',
      [passwordHash, salt, 'admin']
    );

    res.json({ success: true, message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
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

// Serve React app for all other routes
// Rate limit for serving SPA index.html (to mitigate file system abuse)
const spaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window per SPA access
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: "Too many requests, please try again later." },
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = join(__dirname, 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
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
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
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

    // Set file permissions (Windows compatible)
    try {
      fs.chmodSync(resolvedFilePath, 0o666); // Read/write for all
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

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    return res.status(400).json({ error: err.message });
  } else if (err) {
    // An unknown error occurred
    return res.status(500).json({ error: err.message || 'File upload failed' });
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    node: process.version,
  });
});

// Catch-all route for SPA
app.get('*', spaLimiter, (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`HTTP server running on port ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log('Rate limiting active:');
  console.log('- Global API: 300 requests/15min per IP');
  console.log('- Auth endpoints: 20 requests/15min per IP');
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
