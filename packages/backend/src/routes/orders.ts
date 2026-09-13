import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const ordersRouter = Router();

const PLATFORM_COMMISSION_RATE = 0.05; // 5% of sale price - decided

// POST /orders - create an order from an accepted bid or direct "buy now".
// Buyer is taken from the authenticated session.
ordersRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { listingId, amount } = req.body;
  const buyerId = req.user!.userId;

  if (!listingId || amount == null) {
    return res.status(400).json({ error: { message: 'Missing required order fields' } });
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (listing.status !== 'ACTIVE') return res.status(400).json({ error: { message: 'Listing is not available for purchase' } });

  const commissionAmount = Number(amount) * PLATFORM_COMMISSION_RATE;
  const sellerPayoutAmount = Number(amount) - commissionAmount;

  const order = await prisma.order.create({
    data: {
      listingId,
      buyerId,
      sellerId: listing.sellerId,
      amount,
      commissionAmount,
      sellerPayoutAmount,
      status: 'PENDING_PAYMENT',
    },
  });

  // Mark listing as sold once an order is opened against it.
  // (Payment confirmation happens separately via Stripe webhook -> PAID status.)
  await prisma.listing.update({
    where: { id: listingId },
    data: { status: 'SOLD', soldAt: new Date() },
  });

  res.status(201).json(order);
}));

// GET /orders/:id
ordersRouter.get('/:id', asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: String(req.params.id) },
    include: { listing: true, buyer: { select: { id: true, name: true } }, seller: { select: { id: true, name: true } } },
  });

  if (!order) return res.status(404).json({ error: { message: 'Order not found' } });
  res.json(order);
}));

// PATCH /orders/:id/status - update order status (e.g. from Stripe webhook handler)
ordersRouter.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status, stripePaymentIntentId, stripeTransferId } = req.body;

  const order = await prisma.order.update({
    where: { id: String(req.params.id) },
    data: {
      ...(status ? { status } : {}),
      ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
      ...(stripeTransferId ? { stripeTransferId } : {}),
    },
  });

  res.json(order);
}));

// GET /orders?buyerId=... or ?sellerId=...
ordersRouter.get('/', asyncHandler(async (req, res) => {
  const { buyerId, sellerId } = req.query;

  const orders = await prisma.order.findMany({
    where: {
      ...(buyerId ? { buyerId: String(buyerId) } : {}),
      ...(sellerId ? { sellerId: String(sellerId) } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(orders);
}));
