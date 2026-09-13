import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const ratingsRouter = Router();

// POST /orders/:id/rate - rate the OTHER party on a completed order.
// Restricted to participants of a COMPLETED order - this is deliberately
// the only way to leave a rating, so they can't be left by people who were
// never actually part of a finished transaction.
ratingsRouter.post('/orders/:id/rate', requireAuth, asyncHandler(async (req, res) => {
  const { score, comment } = req.body;
  const raterId = req.user!.userId;

  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: { message: 'score must be an integer from 1 to 5' } });
  }

  const order = await prisma.order.findUnique({ where: { id: String(req.params.id) } });
  if (!order) return res.status(404).json({ error: { message: 'Order not found' } });

  const isBuyer = order.buyerId === raterId;
  const isSeller = order.sellerId === raterId;
  if (!isBuyer && !isSeller) {
    return res.status(403).json({ error: { message: 'You were not a party to this order' } });
  }
  if (order.status !== 'COMPLETED') {
    return res.status(400).json({ error: { message: 'You can only rate an order once it is marked complete' } });
  }

  const ratedUserId = isBuyer ? order.sellerId : order.buyerId;

  const existing = await prisma.rating.findUnique({
    where: { orderId_raterId: { orderId: order.id, raterId } },
  });
  if (existing) {
    return res.status(409).json({ error: { message: 'You have already rated this order' } });
  }

  const rating = await prisma.rating.create({
    data: {
      orderId: order.id,
      raterId,
      ratedUserId,
      score,
      comment: comment ? String(comment).trim().slice(0, 1000) : null,
    },
  });

  res.status(201).json(rating);
}));

// GET /users/:id/ratings - public: a user's average rating, count, and the
// individual ratings left about them (rater name + score + comment). This
// is the trust signal buyers/sellers use to size each other up.
ratingsRouter.get('/users/:id/ratings', asyncHandler(async (req, res) => {
  const ratedUserId = String(req.params.id);

  const [ratings, aggregate] = await Promise.all([
    prisma.rating.findMany({
      where: { ratedUserId },
      orderBy: { createdAt: 'desc' },
      include: { rater: { select: { id: true, name: true } } },
    }),
    prisma.rating.aggregate({ where: { ratedUserId }, _avg: { score: true }, _count: true }),
  ]);

  res.json({
    average: aggregate._avg.score ?? null,
    count: aggregate._count,
    ratings,
  });
}));

// GET /orders/:id/rating-eligibility - can the current user rate the other
// party on this order right now, and have they already done so? Lets the
// UI show/hide the "Rate this transaction" prompt without guessing.
ratingsRouter.get('/orders/:id/rating-eligibility', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const order = await prisma.order.findUnique({ where: { id: String(req.params.id) } });
  if (!order) return res.status(404).json({ error: { message: 'Order not found' } });

  const isParticipant = order.buyerId === userId || order.sellerId === userId;
  if (!isParticipant) return res.status(403).json({ error: { message: 'Not your order' } });

  const alreadyRated = await prisma.rating.findUnique({
    where: { orderId_raterId: { orderId: order.id, raterId: userId } },
  });

  res.json({
    eligible: order.status === 'COMPLETED' && !alreadyRated,
    alreadyRated: !!alreadyRated,
    orderStatus: order.status,
  });
}));
