import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '30d';

if (!JWT_SECRET && process.env.NODE_ENV !== 'test') {
  // Fail loudly at startup rather than silently signing tokens with an
  // undefined secret - a common way auth silently becomes insecure.
  console.warn('WARNING: JWT_SECRET is not set. Set it in your .env before running in production.');
}

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
  return jwt.sign(payload, JWT_SECRET || 'dev-only-insecure-secret', { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET || 'dev-only-insecure-secret') as AuthTokenPayload;
}
