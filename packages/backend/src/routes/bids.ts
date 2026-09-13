import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const bidsRouter = Router();

// POST /bids - buyer places a bid on a listing
bidsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { listingId, amount } = req.body;

  if (!listingId || amount == null) {
    return res.status(400).json({ error: { message: 'Missing required bid fields' } });
  }
  if (typeof amount !== 'number' || !(amount > 0)) {
    return res.status(400).json({ error: { message: 'Bid amount must be a positive number' } });
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (listing.sellerId === req.user!.userId) {
    return res.status(400).json({ error: { message: 'You cannot bid on your own listing' } });
  }
  if (!listing.allowBidding) return res.status(400).json({ error: { message: 'Bidding is not enabled for this listing' } });
  if (listing.status !== 'ACTIVE') return res.status(400).json({ error: { message: 'Listing is not active' } });

  const bid = await prisma.bid.create({
    data: { listingId, bidderId: req.user!.userId, amount, status: 'PENDING' },
  });

  res.status(201).json(bid);
}));

// POST /bids/:id/counter - only the listing's seller can counter a bid
bidsRouter.post('/:id/counter', requireAuth, asyncHandler(async (req, res) => {
  const { counterAmount } = req.body;
  if (typeof counterAmount !== 'number' || !(counterAmount > 0)) {
    return res.status(400).json({ error: { message: 'counterAmount must be a positive number' } });
  }

  const existing = await prisma.bid.findUnique({ where: { id: String(req.params.id) }, include: { listing: true } });
  if (!existing) return res.status(404).json({ error: { message: 'Bid not found' } });
  if (existing.listing.sellerId !== req.user!.userId) {
    return res.status(403).json({ error: { message: 'Only the listing seller can counter this bid' } });
  }
  if (existing.status !== 'PENDING') {
    return res.status(400).json({ error: { message: `Cannot counter a bid with status ${existing.status}` } });
  }

  const bid = await prisma.bid.update({
    where: { id: String(req.params.id) },
    data: { counterAmount, status: 'COUNTERED' },
  });

  res.json(bid);
}));

// POST /bids/:id/accept - either the bidder or the seller can accept the current offer
bidsRouter.post('/:id/accept', requireAuth, asyncHandler(async (req, res) => {
  const existing = await prisma.bid.findUnique({ where: { id: String(req.params.id) }, include: { listing: true } });
  if (!existing) return res.status(404).json({ error: { message: 'Bid not found' } });
  const isParty = existing.bidderId === req.user!.userId || existing.listing.sellerId === req.user!.userId;
  if (!isParty) return res.status(403).json({ error: { message: 'Not a party to this bid' } });
  if (existing.status !== 'PENDING' && existing.status !== 'COUNTERED') {
    return res.status(400).json({ error: { message: `Cannot accept a bid with status ${existing.status}` } });
  }
  if (existing.listing.status !== 'ACTIVE') {
    return res.status(400).json({ error: { message: 'This listing is no longer available' } });
  }

  const bid = await prisma.bid.update({
    where: { id: String(req.params.id) },
    data: { status: 'ACCEPTED' },
  });

  res.json(bid);
}));

// POST /bids/:id/reject
bidsRouter.post('/:id/reject', requireAuth, asyncHandler(async (req, res) => {
  const existing = await prisma.bid.findUnique({ where: { id: String(req.params.id) }, include: { listing: true } });
  if (!existing) return res.status(404).json({ error: { message: 'Bid not found' } });
  const isParty = existing.bidderId === req.user!.userId || existing.listing.sellerId === req.user!.userId;
  if (!isParty) return res.status(403).json({ error: { message: 'Not a party to this bid' } });
  if (existing.status !== 'PENDING' && existing.status !== 'COUNTERED') {
    return res.status(400).json({ error: { message: `Cannot reject a bid with status ${existing.status}` } });
  }

  const bid = await prisma.bid.update({
    where: { id: String(req.params.id) },
    data: { status: 'REJECTED' },
  });

  res.json(bid);
}));

// GET /bids?listingId=... - list bids for a listing, or the caller's own bid history.
// Visibility: the listing's seller sees every bid on it; anyone else only
// ever sees their own bids - bid amounts and bidder identity are not public.
bidsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { listingId, bidderId } = req.query;
  const userId = req.user!.userId;

  if (bidderId && String(bidderId) !== userId) {
    return res.status(403).json({ error: { message: "Cannot view another user's bid history" } });
  }

  let where: any = {};

  if (listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: String(listingId) } });
    if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });

    where = listing.sellerId === userId
      ? { listingId: String(listingId) }
      : { listingId: String(listingId), bidderId: userId };
  } else {
    where = { bidderId: userId };
  }

  const bids = await prisma.bid.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  res.json(bids);
}));
