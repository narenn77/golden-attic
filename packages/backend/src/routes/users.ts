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

  const ratingAggregate = await prisma.rating.aggregate({
    where: { ratedUserId: user.id },
    _avg: { score: true },
    _count: true,
  });

  res.json({
    ...user,
    ratingAverage: ratingAggregate._avg.score ?? null,
    ratingCount: ratingAggregate._count,
  });
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

// PATCH /users/me/address - update the current user's saved address (used
// as a seller's ship-from location and pre-filled as a buyer's default
// ship-to address at checkout). Self only, by construction - there's no
// :id in this path.
usersRouter.patch('/me/address', requireAuth, asyncHandler(async (req, res) => {
  const { addressLine1, addressLine2, city, state, postalCode, country } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(addressLine1 !== undefined ? { addressLine1: addressLine1 ? String(addressLine1).slice(0, 200) : null } : {}),
      ...(addressLine2 !== undefined ? { addressLine2: addressLine2 ? String(addressLine2).slice(0, 200) : null } : {}),
      ...(city !== undefined ? { city: city ? String(city).slice(0, 100) : null } : {}),
      ...(state !== undefined ? { state: state ? String(state).slice(0, 100) : null } : {}),
      ...(postalCode !== undefined ? { postalCode: postalCode ? String(postalCode).slice(0, 20) : null } : {}),
      ...(country !== undefined ? { country: country ? String(country).slice(0, 100) : 'US' } : {}),
    },
    select: {
      id: true, email: true, name: true, phone: true, isSeller: true, emailVerified: true, createdAt: true,
      addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, country: true,
    },
  });

  res.json(user);
}));
