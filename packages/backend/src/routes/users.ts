import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const usersRouter = Router();

// POST /users - create a new user account
// NOTE: this is a placeholder. Real auth (password hashing, sessions/JWT,
// email verification) still needs to be designed - see next milestone.
usersRouter.post('/', asyncHandler(async (req, res) => {
  const { email, name, phone } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: { message: 'email and name are required' } });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: { message: 'User already exists' } });

  const user = await prisma.user.create({
    data: { email, name, phone },
  });

  res.status(201).json(user);
}));

// GET /users/:id
usersRouter.get('/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, email: true, name: true, phone: true,
      isSeller: true, createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json(user);
}));

// PATCH /users/:id/become-seller - flips a buyer into a seller
usersRouter.patch('/:id/become-seller', asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isSeller: true },
  });

  res.json(user);
}));
