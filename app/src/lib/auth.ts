import { authApi, utilityApi } from './api-client';

// Secure randomness utilities
const getCrypto = (): Crypto => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    return globalThis.crypto as Crypto;
  }
  throw new Error('Secure crypto.getRandomValues is not available in this environment');
};

const getSecureRandomInt = (maxExclusive: number): number => {
  if (maxExclusive <= 0) throw new Error('maxExclusive must be > 0');
  const cryptoObj = getCrypto();
  // Rejection sampling to avoid modulo bias
  const maxUint32 = 0xFFFFFFFF;
  const limit = Math.floor((maxUint32 + 1) / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    cryptoObj.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % maxExclusive;
};

const secureShuffle = (input: string[]): string[] => {
  for (let i = input.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const tmp = input[i];
    input[i] = input[j];
    input[j] = tmp;
  }
  return input;
};

// Check if this is the first time setup (no admin exists)
export const isFirstTimeSetup = async (): Promise<boolean> => {
  try {
    const result = await authApi.checkSetupStatus();
    return result.isFirstTimeSetup;
  } catch (error) {
    console.error('Error in isFirstTimeSetup:', error);
    return true;
  }
};

// Setup initial admin credentials
export const setupInitialCredentials = async (password: string): Promise<boolean> => {
  try {
    await authApi.setup(password);
    return true;
  } catch (error) {
    console.error('Error in setupInitialCredentials:', error);
    throw error;
  }
};

// Authenticate user (username defaults to 'admin' for backward compat)
export const authenticateUser = async (password: string, username = 'admin'): Promise<{ authenticated: boolean; requiresTwoFactor?: boolean; challengeToken?: string }> => {
  try {
    const response = await authApi.login(password, username);
    return response.requiresTwoFactor
      ? { authenticated: false, requiresTwoFactor: true, challengeToken: response.challengeToken }
      : { authenticated: Boolean(response.token) };
  } catch (error) {
    console.error('Error in authenticateUser:', error);
    return { authenticated: false };
  }
};

// Check if user is currently authenticated
export const isAuthenticated = (): boolean => {
  return authApi.isAuthenticated();
};

export const hasStoredAuthToken = (): boolean => {
  return authApi.hasStoredToken();
};

// Kept for backward compatibility — token management is handled by the API client
export const setAuthenticated = (_username: string): void => { /* no-op */ };

// Logout user
export const logout = (): void => {
  authApi.logout();
};

// Enhanced password validation
export const isPasswordStrong = async (password: string): Promise<boolean> => {
  try {
    const result = await utilityApi.validatePassword(password);
    return result.isStrong;
  } catch (error) {
    // Fallback to client-side validation
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return password.length >= minLength && hasUppercase && hasLowercase && hasNumbers && hasSpecialChar;
  }
};

// Generate a cryptographically secure password
export const generateSecurePassword = async (): Promise<string> => {
  try {
    const result = await utilityApi.generatePassword();
    return result.password;
  } catch (error) {
    // Fallback to client-side generation
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*(),.?":{}|<>';
    
    // Ensure at least one character from each category
    let password = '';
    password += uppercase[getSecureRandomInt(uppercase.length)];
    password += lowercase[getSecureRandomInt(lowercase.length)];
    password += numbers[getSecureRandomInt(numbers.length)];
    password += special[getSecureRandomInt(special.length)];
    
    // Fill remaining length with random characters
    const allChars = uppercase + lowercase + numbers + special;
    for (let i = 4; i < 16; i++) {
      password += allChars[getSecureRandomInt(allChars.length)];
    }
    
    // Shuffle the password
    const shuffled = secureShuffle(password.split(''));
    return shuffled.join('');
  }
};

// Get current user credentials (safe data only)
// Always returns admin username if authenticated, null otherwise
export const getCurrentCredentials = async (): Promise<{ username: string } | null> => {
  try {
    if (!isAuthenticated()) return null;
    
    const result = await authApi.verify();
    return result.valid ? { username: 'admin' } : null;
  } catch {
    return null;
  }
};

