import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '30d';

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // Never allow production to run with a shared, guessable fallback secret -
    // that would let anyone forge valid auth tokens. Fail startup instead.
    throw new Error('JWT_SECRET must be set in production. Refusing to start with an insecure default.');
  }
  console.warn('WARNING: JWT_SECRET is not set. Set it in your .env before running in production.');
}

const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-insecure-secret';

export async function hashPassword(password: string): Promise<string> {
  const SALT_ROUNDS = 12;
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, EFFECTIVE_JWT_SECRET) as AuthTokenPayload;
}

// Generates a URL-safe random token for email verification / password reset links.
// Returns both the raw token (sent to the user, never stored) and a SHA-256 hash
// of it (stored in the DB) - so a leaked database never exposes usable tokens,
// while still letting us look a token up deterministically when it comes back.
export function generateSecureToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashSecureToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
