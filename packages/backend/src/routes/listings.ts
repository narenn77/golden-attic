import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';

export const listingsRouter = Router();

// GET /listings - browse active listings, with basic filtering.
// A non-ACTIVE status filter (DRAFT, REMOVED, etc.) is only honored when the
// caller is asking about their own listings - otherwise a seller's
// unpublished drafts or removed listings would be publicly browsable.
listingsRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { category, sellerId, status } = req.query;

  const requestedStatus = status ? String(status) : 'ACTIVE';
  const isOwnListings = !!sellerId && req.user?.userId === String(sellerId);
  const effectiveStatus = requestedStatus === 'ACTIVE' || isOwnListings ? requestedStatus : 'ACTIVE';

  const listings = await prisma.listing.findMany({
    where: {
      ...(category ? { category: String(category) } : {}),
      ...(sellerId ? { sellerId: String(sellerId) } : {}),
      status: effectiveStatus as any,
    },
    orderBy: { createdAt: 'desc' },
    include: { seller: { select: { id: true, name: true } } },
  });

  res.json(listings);
}));

// GET /listings/:id
listingsRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: String(req.params.id) },
    include: {
      seller: { select: { id: true, name: true } },
      bids: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });

  // Bid amounts and bidder identity are not public: the seller sees every
  // bid on their own listing, a bidder sees only their own bid, and anyone
  // else (including anonymous visitors) sees none.
  const userId = req.user?.userId;
  const visibleBids =
    userId && userId === listing.sellerId
      ? listing.bids
      : listing.bids.filter((bid) => bid.bidderId === userId);

  res.json({ ...listing, bids: visibleBids });
}));

// POST /listings - create a new listing (draft). Seller is taken from the
// authenticated session, never trusted from the request body.
listingsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { title, description, category, price, images, aiGenerated, allowBidding } = req.body;

  if (!title || !description || !category || price == null) {
    return res.status(400).json({ error: { message: 'Missing required listing fields' } });
  }

  const listing = await prisma.listing.create({
    data: {
      sellerId: req.user!.userId,
      title,
      description,
      category,
      price,
      images: images ?? [],
      aiGenerated: aiGenerated ?? false,
      allowBidding: allowBidding ?? true,
      status: 'DRAFT',
    },
  });

  res.status(201).json(listing);
}));

// POST /listings/:id/publish - go from DRAFT to ACTIVE, starts the free hosting month
listingsRouter.post('/:id/publish', requireAuth, asyncHandler(async (req, res) => {
  const existing = await prisma.listing.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (existing.sellerId !== req.user!.userId) {
    return res.status(403).json({ error: { message: 'Not your listing' } });
  }

  const now = new Date();
  const freeUntil = new Date(now);
  freeUntil.setMonth(freeUntil.getMonth() + 1);

  const listing = await prisma.listing.update({
    where: { id: String(req.params.id) },
    data: {
      status: 'ACTIVE',
      publishedAt: now,
      freeUntil,
      hostingPaidUntil: freeUntil,
    },
  });

  res.json(listing);
}));

// PATCH /listings/:id - update listing fields (price changes, description edits, etc.)
listingsRouter.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const existing = await prisma.listing.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (existing.sellerId !== req.user!.userId) {
    return res.status(403).json({ error: { message: 'Not your listing' } });
  }

  const { title, description, category, price, images, allowBidding } = req.body;
  // NOTE: status is intentionally not editable here - it only transitions via
  // /publish (DRAFT -> ACTIVE, which also sets up the free-hosting-month
  // fields) and DELETE (-> REMOVED). Allowing it here would let a seller skip
  // that setup or reactivate a listing that already sold.

  const listing = await prisma.listing.update({
    where: { id: String(req.params.id) },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(allowBidding !== undefined ? { allowBidding } : {}),
    },
  });

  res.json(listing);
}));

// DELETE /listings/:id
listingsRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const existing = await prisma.listing.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (existing.sellerId !== req.user!.userId) {
    return res.status(403).json({ error: { message: 'Not your listing' } });
  }

  await prisma.listing.update({
    where: { id: String(req.params.id) },
    data: { status: 'REMOVED' },
  });
  res.status(204).send();
}));
