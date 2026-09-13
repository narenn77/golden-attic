import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const bidsRouter = Router();

// POST /bids - buyer places a bid on a listing
bidsRouter.post('/', asyncHandler(async (req, res) => {
  const { listingId, bidderId, amount } = req.body;

  if (!listingId || !bidderId || amount == null) {
    return res.status(400).json({ error: { message: 'Missing required bid fields' } });
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (!listing.allowBidding) return res.status(400).json({ error: { message: 'Bidding is not enabled for this listing' } });
  if (listing.status !== 'ACTIVE') return res.status(400).json({ error: { message: 'Listing is not active' } });

  const bid = await prisma.bid.create({
    data: { listingId, bidderId, amount, status: 'PENDING' },
  });

  res.status(201).json(bid);
}));

// POST /bids/:id/counter - seller counters with a lower price
bidsRouter.post('/:id/counter', asyncHandler(async (req, res) => {
  const { counterAmount } = req.body;
  if (counterAmount == null) {
    return res.status(400).json({ error: { message: 'counterAmount is required' } });
  }

  const bid = await prisma.bid.update({
    where: { id: req.params.id },
    data: { counterAmount, status: 'COUNTERED' },
  });

  res.json(bid);
}));

// POST /bids/:id/accept - either party accepts the current price on the table
bidsRouter.post('/:id/accept', asyncHandler(async (req, res) => {
  const bid = await prisma.bid.update({
    where: { id: req.params.id },
    data: { status: 'ACCEPTED' },
  });

  res.json(bid);
}));

// POST /bids/:id/reject
bidsRouter.post('/:id/reject', asyncHandler(async (req, res) => {
  const bid = await prisma.bid.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED' },
  });

  res.json(bid);
}));

// GET /bids?listingId=... - list bids for a listing
bidsRouter.get('/', asyncHandler(async (req, res) => {
  const { listingId, bidderId } = req.query;

  const bids = await prisma.bid.findMany({
    where: {
      ...(listingId ? { listingId: String(listingId) } : {}),
      ...(bidderId ? { bidderId: String(bidderId) } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(bids);
}));
