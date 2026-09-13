import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const usersRouter = Router();

// Account creation now happens via POST /auth/signup, which sets a password.

// GET /users/:id - public profile only. Email and phone are private and are
// only ever returned to the account owner via GET /auth/me.
usersRouter.get('/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true, name: true, isSeller: true, createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json(user);
}));

// PATCH /users/:id/become-seller - flips a buyer into a seller (self only)
usersRouter.patch('/:id/become-seller', requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.userId !== String(req.params.id)) {
    return res.status(403).json({ error: { message: 'Cannot modify another user' } });
  }

  const user = await prisma.user.update({
    where: { id: String(req.params.id) },
    data: { isSeller: true },
    // Never return the raw record here - it carries the password hash and
    // verification/reset token hashes, which must never reach a client.
    select: { id: true, email: true, name: true, phone: true, isSeller: true, emailVerified: true, createdAt: true },
  });

  res.json(user);
}));
