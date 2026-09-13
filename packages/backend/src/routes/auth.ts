import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js';

export const authRouter = Router();

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /auth/signup
authRouter.post('/signup', asyncHandler(async (req, res) => {
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
  const user = await prisma.user.create({
    data: { email, name, phone, passwordHash },
  });

  const token = signToken({ userId: user.id, email: user.email });

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, isSeller: user.isSeller },
  });
}));

// POST /auth/login
authRouter.post('/login', asyncHandler(async (req, res) => {
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
    user: { id: user.id, email: user.email, name: user.name, isSeller: user.isSeller },
  });
}));

// GET /auth/me - return the current logged-in user (requires auth)
import { requireAuth } from '../middleware/requireAuth.js';

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, name: true, phone: true, isSeller: true, createdAt: true },
  });

  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json(user);
}));
