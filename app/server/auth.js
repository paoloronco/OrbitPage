import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbAll, dbGet, dbRun } from './database.js';
import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';

const KNOWN_INSECURE_JWT_SECRETS = new Set([
  'change-me',
  'change-me-to-a-long-random-string',
  'replace-with-a-long-random-secret',
  'secret',
  'your-secret-key',
]);

export const isStrongJwtSecret = (value) => {
  const secret = typeof value === 'string' ? value.trim() : '';
  return secret.length >= 32 && !KNOWN_INSECURE_JWT_SECRETS.has(secret.toLowerCase());
};

const configuredJwtSecret = process.env.JWT_SECRET;
const allowsEphemeralDevelopmentSecret = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
if (!allowsEphemeralDevelopmentSecret && !isStrongJwtSecret(configuredJwtSecret)) {
  throw new Error('JWT_SECRET must be at least 32 characters and must not use a known placeholder.');
}

const JWT_SECRET = isStrongJwtSecret(configuredJwtSecret)
  ? configuredJwtSecret.trim()
  : randomBytes(32).toString('hex');
const TWO_FACTOR_JWT_SECRET = `${JWT_SECRET}-two-factor`;
const JWT_ALGORITHM = 'HS256';
const SALT_ROUNDS = 12;
export const PERSONAL_API_TOKEN_PREFIX = 'op_pat_';

// --- Role-Based Access Control ---

export const ROLES = [
  'admin', 'editor', 'links_editor', 'links_style', 'links_images',
  'theme_editor', 'compliance', 'viewer',
];

export const ROLE_PERMISSIONS = {
  admin:        ['links:write', 'links:style', 'links:images', 'theme:write', 'profile:write', 'menu:write', 'analytics:read', 'compliance:write', 'users:manage'],
  editor:       ['links:write', 'profile:write', 'menu:write', 'analytics:read'],
  links_editor: ['links:write', 'analytics:read'],
  links_style:  ['links:style'],
  links_images: ['links:images'],
  theme_editor: ['theme:write'],
  compliance:   ['compliance:write'],
  viewer:       ['analytics:read'],
};

export const getPermissionsForRole = (username, role) => {
  if (username === 'admin') return ROLE_PERMISSIONS.admin;
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
};

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!(req.user.permissions || []).includes(permission)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

export const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const has = permissions.some(p => (req.user.permissions || []).includes(p));
  if (!has) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

// Check if this is the first time setup (no admin exists)
export const isFirstTimeSetup = async () => {
  try {
    const result = await dbGet('SELECT COUNT(*) as count FROM admin_users');
    return result.count === 0;
  } catch (error) {
    console.error('Error checking first time setup:', error);
    return true;
  }
};

// Setup initial admin credentials
export const setupInitialCredentials = async (password) => {
  try {
    const firstTime = await isFirstTimeSetup();
    if (!firstTime) {
      throw new Error('Admin account already exists');
    }

    if (!isPasswordStrong(password)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    await dbRun(
      'INSERT INTO admin_users (username, password_hash, salt) VALUES (?, ?, ?)',
      ['admin', passwordHash, salt]
    );

    return true;
  } catch (error) {
    console.error('Error in setupInitialCredentials:', error);
    throw error;
  }
};

// Authenticate user against database
export const authenticateUser = async (password, username = 'admin', includeSession = false) => {
  try {
    const user = await dbGet(
      'SELECT username, password_hash, salt, auth_version, session_id, totp_enabled FROM admin_users WHERE username = ?',
      [username]
    );

    if (!user) {
      return false;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    return isMatch ? (includeSession ? user : true) : false;
  } catch (error) {
    console.error('Error in authenticateUser:', error);
    return false;
  }
};

// Generate JWT token
export const generateToken = (username, authVersion, sessionId) => {
  if (!sessionId) throw new Error('Account session identity is required.');
  return jwt.sign(
    { username, authVersion, sessionId, timestamp: Date.now() },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: '12h' }
  );
};

const hashPersonalApiToken = (token) => createHash('sha256').update(token).digest('hex');

const personalApiTokenRecord = (row) => ({
  tokenId: row.id,
  name: row.name,
  tokenPrefix: row.token_prefix,
  scopes: JSON.parse(row.scopes || '[]'),
  username: row.username,
  status: row.status,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  lastUsedAt: row.last_used_at,
  revokedAt: row.revoked_at,
});

export const listPersonalApiTokens = async (username) => (
  await dbAll('SELECT * FROM personal_api_tokens WHERE username = ? ORDER BY created_at DESC', [username])
).map(personalApiTokenRecord);

export const createPersonalApiToken = async (username, { name, scopes, expiresInDays }) => {
  const active = await dbGet(
    `SELECT COUNT(*) AS count FROM personal_api_tokens
     WHERE username = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)`,
    [username, new Date().toISOString()],
  );
  if (Number(active?.count || 0) >= 10) throw new Error('TOKEN_LIMIT_REACHED');

  const token = `${PERSONAL_API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const now = new Date();
  const expiresAt = expiresInDays === null
    ? null
    : new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const row = {
    id: randomUUID(), username, name: name.trim(), token_prefix: token.slice(0, 18),
    token_hash: hashPersonalApiToken(token), scopes: JSON.stringify(scopes), status: 'active',
    created_at: now.toISOString(), expires_at: expiresAt, last_used_at: null, revoked_at: null,
  };
  await dbRun(
    `INSERT INTO personal_api_tokens
      (id, username, name, token_prefix, token_hash, scopes, status, created_at, expires_at, last_used_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.username, row.name, row.token_prefix, row.token_hash, row.scopes, row.status,
      row.created_at, row.expires_at, row.last_used_at, row.revoked_at],
  );
  return { token, record: personalApiTokenRecord(row) };
};

export const revokePersonalApiToken = async (username, tokenId) => {
  const now = new Date().toISOString();
  const result = await dbRun(
    `UPDATE personal_api_tokens SET status = 'revoked', revoked_at = ?
     WHERE id = ? AND username = ? AND status = 'active'`,
    [now, tokenId, username],
  );
  if (!result.changes) return null;
  return personalApiTokenRecord(await dbGet('SELECT * FROM personal_api_tokens WHERE id = ?', [tokenId]));
};

export const generateTwoFactorChallenge = (username, authVersion, sessionId) => jwt.sign(
  { username, authVersion, sessionId, purpose: 'two-factor-login' },
  TWO_FACTOR_JWT_SECRET,
  { algorithm: JWT_ALGORITHM, expiresIn: '5m', audience: 'orbitpage-two-factor', issuer: 'orbitpage' },
);

export const verifyTwoFactorChallenge = (token) => {
  try {
    const decoded = jwt.verify(token, TWO_FACTOR_JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      audience: 'orbitpage-two-factor',
      issuer: 'orbitpage',
    });
    return decoded?.purpose === 'two-factor-login' ? decoded : null;
  } catch {
    return null;
  }
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    return decoded && typeof decoded === 'object' && decoded.purpose === undefined ? decoded : null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
};

// Verify reset token
export const verifyResetToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET + '-reset');
  } catch (error) {
    console.error('Reset token verification failed:', error);
    return null;
  }
};

// Enhanced password validation
export const isPasswordStrong = (password) => {
  const minLength = 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return password.length >= minLength && hasUppercase && hasLowercase && hasNumbers && hasSpecialChar;
};

// Hash a password
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

// Verify a password
export const verifyPassword = async (password, hash) => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
};

// Get admin username (always 'admin')
export const getAdminUsername = () => 'admin';

// Generate a cryptographically secure password
export const generateSecurePassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*(),.?":{}|<>';

  let password = '';
  password += uppercase[randomInt(uppercase.length)];
  password += lowercase[randomInt(lowercase.length)];
  password += numbers[randomInt(numbers.length)];
  password += special[randomInt(special.length)];

  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 4; i < 16; i++) {
    password += allChars[randomInt(allChars.length)];
  }

  const arr = password.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
};

// Middleware to verify authentication and attach role + permissions to req.user
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    if (token.startsWith(PERSONAL_API_TOKEN_PREFIX)) {
      const storedToken = await dbGet(
        `SELECT * FROM personal_api_tokens
         WHERE token_hash = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)`,
        [hashPersonalApiToken(token), new Date().toISOString()],
      );
      if (!storedToken) return res.status(403).json({ error: 'Invalid or expired token' });
      const user = await dbGet('SELECT username, role FROM admin_users WHERE username = ?', [storedToken.username]);
      if (!user) return res.status(403).json({ error: 'User not found' });
      const rolePermissions = getPermissionsForRole(user.username, user.role || 'admin');
      const scopes = JSON.parse(storedToken.scopes || '[]')
        .filter((scope) => scope !== 'users:manage' && rolePermissions.includes(scope));
      await dbRun('UPDATE personal_api_tokens SET last_used_at = ? WHERE id = ?', [new Date().toISOString(), storedToken.id]);
      req.user = {
        username: user.username,
        role: user.role || 'admin',
        permissions: scopes,
        authType: 'personal_token',
        tokenId: storedToken.id,
      };
      return next();
    }

    const decoded = verifyToken(token);
    if (!decoded) return res.status(403).json({ error: 'Invalid or expired token' });
    const user = await dbGet(
      'SELECT username, role, auth_version, session_id FROM admin_users WHERE username = ?',
      [decoded.username]
    );

    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }
    if (!decoded.sessionId || decoded.sessionId !== user.session_id || Number(decoded.authVersion || 0) !== Number(user.auth_version || 0)) {
      return res.status(403).json({ error: 'Session has been revoked' });
    }

    req.user = {
      ...decoded,
      role: user.role || 'admin',
      permissions: getPermissionsForRole(decoded.username, user.role || 'admin'),
      authType: 'session',
    };
    next();
  } catch (error) {
    console.error('Database error during authentication:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
