import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const ordersRouter = Router();

const PLATFORM_COMMISSION_RATE = 0.05; // 5% of sale price - decided

// POST /orders - open an order against a listing, either at the listing's
// asking price (direct "buy now") or at a bid's negotiated price.
//
// SECURITY: the sale amount is ALWAYS derived server-side from the listing
// (or an accepted bid belonging to that listing) - a client-supplied amount
// is never trusted, since that would let a buyer name their own price.
ordersRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { listingId, bidId } = req.body;
  const buyerId = req.user!.userId;

  if (!listingId) {
    return res.status(400).json({ error: { message: 'listingId is required' } });
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (listing.status !== 'ACTIVE') {
    return res.status(400).json({ error: { message: 'Listing is not available for purchase' } });
  }
  if (listing.sellerId === buyerId) {
    return res.status(400).json({ error: { message: 'You cannot buy your own listing' } });
  }

  // A listing can only have one payable order in flight at a time. Previous
  // failed/cancelled attempts don't block this - only a still-pending (and
  // not stale) or already-paid order does. A PENDING_PAYMENT order older than
  // 30 minutes is treated as abandoned so one user can't permanently block
  // others from buying a listing just by opening a checkout and never paying.
  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000);
  const existingOpenOrder = await prisma.order.findFirst({
    where: {
      listingId,
      OR: [
        { status: 'PAID' },
        { status: 'PENDING_PAYMENT', createdAt: { gte: staleCutoff } },
      ],
    },
  });
  if (existingOpenOrder) {
    return res.status(409).json({ error: { message: 'This listing already has an order in progress' } });
  }

  let amount: number;

  if (bidId) {
    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid || bid.listingId !== listingId) {
      return res.status(404).json({ error: { message: 'Bid not found for this listing' } });
    }
    if (bid.bidderId !== buyerId) {
      return res.status(403).json({ error: { message: 'This is not your bid' } });
    }
    if (bid.status !== 'ACCEPTED') {
      return res.status(400).json({ error: { message: 'Only an accepted bid can be checked out' } });
    }
    // A seller's counter-offer supersedes the buyer's original amount once accepted.
    amount = Number(bid.counterAmount ?? bid.amount);
  } else {
    amount = Number(listing.price);
  }

  const commissionAmount = Math.round(amount * PLATFORM_COMMISSION_RATE * 100) / 100;
  const sellerPayoutAmount = Math.round((amount - commissionAmount) * 100) / 100;

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

  // NOTE: the listing intentionally stays ACTIVE here rather than flipping to
  // SOLD immediately. It only becomes SOLD once Stripe confirms payment (see
  // the payment_intent.succeeded handler in payments.ts). Otherwise, any
  // logged-in user could "reserve" someone else's listing indefinitely by
  // opening checkout and never paying - the stale-order check above is what
  // actually protects against that for a real buyer's next attempt, but the
  // listing itself should keep showing as available in the meantime.

  res.status(201).json(order);
}));

// GET /orders/:id - only the buyer or seller on the order may view it.
ordersRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: String(req.params.id) },
    include: { listing: true, buyer: { select: { id: true, name: true } }, seller: { select: { id: true, name: true } } },
  });

  if (!order) return res.status(404).json({ error: { message: 'Order not found' } });
  if (order.buyerId !== req.user!.userId && order.sellerId !== req.user!.userId) {
    return res.status(403).json({ error: { message: 'Not your order' } });
  }

  res.json(order);
}));

// GET /orders - only ever returns the current user's own orders (as buyer
// and/or seller) - there is no way to query another user's order history.
ordersRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { role } = req.query; // optional: 'buyer' | 'seller' to filter which side
  const userId = req.user!.userId;

  const where =
    role === 'buyer' ? { buyerId: userId } : role === 'seller' ? { sellerId: userId } : { OR: [{ buyerId: userId }, { sellerId: userId }] };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  res.json(orders);
}));
