import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun } from './database.js';
import { randomBytes, randomInt } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. A random key was generated at runtime; tokens will be invalidated on restart. Set JWT_SECRET in production.');
}
const SALT_ROUNDS = 12;

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
export const authenticateUser = async (password, username = 'admin') => {
  try {
    const user = await dbGet(
      'SELECT username, password_hash, salt FROM admin_users WHERE username = ?',
      [username]
    );

    if (!user) {
      return false;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    return isMatch;
  } catch (error) {
    console.error('Error in authenticateUser:', error);
    return false;
  }
};

// Generate JWT token
export const generateToken = (username) => {
  return jwt.sign(
    { username, timestamp: Date.now() },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
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

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    const user = await dbGet(
      'SELECT username, role FROM admin_users WHERE username = ?',
      [decoded.username]
    );

    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    req.user = {
      ...decoded,
      role: user.role || 'admin',
      permissions: getPermissionsForRole(decoded.username, user.role || 'admin'),
    };
    next();
  } catch (error) {
    console.error('Database error during authentication:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
