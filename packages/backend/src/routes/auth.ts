import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  generateSecureToken,
  hashSecureToken,
} from '../lib/auth.js';
import { sendEmail, verificationEmailBody, passwordResetEmailBody } from '../lib/email.js';

export const authRouter = Router();

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// TODO: set APP_URL once the web/mobile deep-link scheme is decided.
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Rate limits are disabled (effectively) in the test environment so the test
// suite can exercise many auth attempts in quick succession without tripping
// the same brute-force protection a real attacker would hit. Rate limiting
// itself is covered by a dedicated test using its own isolated app/limiter.
const IS_TEST = process.env.NODE_ENV === 'test';

// Brute-force protection: 10 attempts per 15 minutes per IP on login,
// 5 signups per hour per IP (signup is cheap to abuse for spam accounts).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: IS_TEST ? 100000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Please try again later.' } },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: IS_TEST ? 100000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many accounts created from this address. Please try again later.' } },
});

// A tighter limiter for anything that sends an email (verification resend,
// password reset request) - these are the classic email-bombing vectors.
const emailActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: IS_TEST ? 100000 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests. Please try again later.' } },
});

// ---------- Signup / Login ----------

// POST /auth/signup
authRouter.post('/signup', signupLimiter, asyncHandler(async (req, res) => {
  const { email, password, name, phone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: { message: 'email, password, and name are required' } });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: { message: 'Invalid email address' } });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: { message: 'Password must be at least 8 characters' } });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: { message: 'An account with this email already exists' } });
  }

  const passwordHash = await hashPassword(password);
  const { raw: verifyRaw, hash: verifyHash } = generateSecureToken();
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone,
      passwordHash,
      emailVerificationToken: verifyHash,
      emailVerificationExpires,
    },
  });

  await sendEmail(
    user.email,
    'Verify your Golden Attic account',
    verificationEmailBody(`${APP_URL}/verify-email?token=${verifyRaw}`)
  );

  const token = signToken({ userId: user.id, email: user.email });

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, isSeller: user.isSeller, emailVerified: user.emailVerified },
  });
}));

// POST /auth/login
authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: { message: 'email and password are required' } });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Same error for "no such user" and "wrong password" - don't reveal which one.
  const genericError = { error: { message: 'Invalid email or password' } };

  if (!user || !user.passwordHash) {
    return res.status(401).json(genericError);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json(genericError);
  }

  const token = signToken({ userId: user.id, email: user.email });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, isSeller: user.isSeller, emailVerified: user.emailVerified },
  });
}));

// GET /auth/me - return the current logged-in user (requires auth)
authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true, email: true, name: true, phone: true, isSeller: true, emailVerified: true, createdAt: true,
      addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, country: true,
    },
  });

  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json(user);
}));

// ---------- Email verification ----------

// POST /auth/verify-email - consumes the token from the emailed link
authRouter.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: { message: 'token is required' } });

  const hash = hashSecureToken(token);
  const user = await prisma.user.findUnique({ where: { emailVerificationToken: hash } });

  if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
    return res.status(400).json({ error: { message: 'Invalid or expired verification link' } });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerificationToken: null, emailVerificationExpires: null },
  });

  res.json({ message: 'Email verified' });
}));

// POST /auth/resend-verification (requires auth - resends for the logged-in user)
authRouter.post('/resend-verification', requireAuth, emailActionLimiter, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  if (user.emailVerified) return res.json({ message: 'Email already verified' });

  const { raw: verifyRaw, hash: verifyHash } = generateSecureToken();
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: verifyHash, emailVerificationExpires },
  });

  await sendEmail(
    user.email,
    'Verify your Golden Attic account',
    verificationEmailBody(`${APP_URL}/verify-email?token=${verifyRaw}`)
  );

  res.json({ message: 'Verification email sent' });
}));

// ---------- Password reset ----------

// POST /auth/forgot-password - always returns success, whether or not the email exists,
// so this endpoint can't be used to enumerate registered accounts.
authRouter.post('/forgot-password', emailActionLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: { message: 'email is required' } });

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const { raw: resetRaw, hash: resetHash } = generateSecureToken();
    const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetHash, passwordResetExpires },
    });

    await sendEmail(
      user.email,
      'Reset your Golden Attic password',
      passwordResetEmailBody(`${APP_URL}/reset-password?token=${resetRaw}`)
    );
  }

  res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
}));

// POST /auth/reset-password - consumes the token, sets a new password
authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: { message: 'token and newPassword are required' } });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: { message: 'Password must be at least 8 characters' } });
  }

  const hash = hashSecureToken(token);
  const user = await prisma.user.findUnique({ where: { passwordResetToken: hash } });

  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return res.status(400).json({ error: { message: 'Invalid or expired reset link' } });
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
  });

  res.json({ message: 'Password reset. You can now log in with your new password.' });
}));
