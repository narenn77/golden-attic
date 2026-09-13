import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const listingsRouter = Router();

// GET /listings - browse active listings, with basic filtering
listingsRouter.get('/', asyncHandler(async (req, res) => {
  const { category, sellerId, status } = req.query;

  const listings = await prisma.listing.findMany({
    where: {
      ...(category ? { category: String(category) } : {}),
      ...(sellerId ? { sellerId: String(sellerId) } : {}),
      status: status ? (String(status) as any) : 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
    include: { seller: { select: { id: true, name: true } } },
  });

  res.json(listings);
}));

// GET /listings/:id
listingsRouter.get('/:id', asyncHandler(async (req, res) => {
  const listing = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: {
      seller: { select: { id: true, name: true } },
      bids: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });
  res.json(listing);
}));

// POST /listings - create a new listing (draft)
listingsRouter.post('/', asyncHandler(async (req, res) => {
  const { sellerId, title, description, category, price, images, aiGenerated, allowBidding } = req.body;

  if (!sellerId || !title || !description || !category || price == null) {
    return res.status(400).json({ error: { message: 'Missing required listing fields' } });
  }

  const listing = await prisma.listing.create({
    data: {
      sellerId,
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
listingsRouter.post('/:id/publish', asyncHandler(async (req, res) => {
  const now = new Date();
  const freeUntil = new Date(now);
  freeUntil.setMonth(freeUntil.getMonth() + 1);

  const listing = await prisma.listing.update({
    where: { id: req.params.id },
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
listingsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const { title, description, category, price, images, allowBidding, status } = req.body;

  const listing = await prisma.listing.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(allowBidding !== undefined ? { allowBidding } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  });

  res.json(listing);
}));

// DELETE /listings/:id
listingsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.listing.update({
    where: { id: req.params.id },
    data: { status: 'REMOVED' },
  });
  res.status(204).send();
}));
