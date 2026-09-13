import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  generateSecureToken,
  hashSecureToken,
} from '../../src/lib/auth.js';

describe('unit: password hashing', () => {
  it('hashes a password to something other than the plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('rejects an incorrect password against a hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const hashA = await hashPassword('same-password');
    const hashB = await hashPassword('same-password');
    expect(hashA).not.toBe(hashB);
  });
});

describe('unit: JWT signing/verification', () => {
  it('round-trips a payload through sign and verify', () => {
    const token = signToken({ userId: 'user-123', email: 'a@example.com' });
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user-123');
    expect(decoded.email).toBe('a@example.com');
  });

  it('rejects a tampered token', () => {
    const token = signToken({ userId: 'user-123', email: 'a@example.com' });
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('rejects garbage input', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });
});

describe('unit: secure token generation (email verification / password reset)', () => {
  it('generates a random raw token and a deterministic hash of it', () => {
    const { raw, hash } = generateSecureToken();
    expect(raw).toHaveLength(64); // 32 bytes hex-encoded
    expect(hash).toHaveLength(64); // sha256 hex-encoded
    expect(hashSecureToken(raw)).toBe(hash);
  });

  it('generates a different raw token on every call', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a.raw).not.toBe(b.raw);
  });

  it('hashing is deterministic - same input always produces the same hash', () => {
    const { raw } = generateSecureToken();
    expect(hashSecureToken(raw)).toBe(hashSecureToken(raw));
  });

  it('a different raw token never produces the same hash', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(hashSecureToken(a.raw)).not.toBe(hashSecureToken(b.raw));
  });
});
