import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { LISTING_CATEGORIES } from '@golden-attic/shared';

export const listingsRouter = Router();

const SORT_OPTIONS = {
  newest: { createdAt: 'desc' as const },
  oldest: { createdAt: 'asc' as const },
  price_asc: { price: 'asc' as const },
  price_desc: { price: 'desc' as const },
  year_newest: { year: 'desc' as const },
  year_oldest: { year: 'asc' as const },
};

// GET /listings - browse active listings.
// Filters: category, country, decade (a "decade" param like "1950" matches
// years 1950-1959 inclusive), minPrice/maxPrice (e.g. band filters in $100
// increments - a UI can send minPrice=100&maxPrice=200 for "$100-$200").
// Sort: one of newest (default), oldest, price_asc, price_desc,
// year_newest, year_oldest.
// A non-ACTIVE status filter (DRAFT, REMOVED, etc.) is only honored when the
// caller is asking about their own listings - otherwise a seller's
// unpublished drafts or removed listings would be publicly browsable.
listingsRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { category, sellerId, status, country, decade, minPrice, maxPrice, sort } = req.query;

  const requestedStatus = status ? String(status) : 'ACTIVE';
  const isOwnListings = !!sellerId && req.user?.userId === String(sellerId);
  const effectiveStatus = requestedStatus === 'ACTIVE' || isOwnListings ? requestedStatus : 'ACTIVE';

  let yearFilter: { gte: number; lte: number } | undefined;
  if (decade) {
    const decadeStart = parseInt(String(decade), 10);
    if (!Number.isNaN(decadeStart)) {
      yearFilter = { gte: decadeStart, lte: decadeStart + 9 };
    }
  }

  let priceFilter: { gte?: number; lte?: number } | undefined;
  const min = minPrice != null ? parseFloat(String(minPrice)) : NaN;
  const max = maxPrice != null ? parseFloat(String(maxPrice)) : NaN;
  if (!Number.isNaN(min) || !Number.isNaN(max)) {
    priceFilter = {
      ...(!Number.isNaN(min) ? { gte: min } : {}),
      ...(!Number.isNaN(max) ? { lte: max } : {}),
    };
  }

  const orderBy = (sort && SORT_OPTIONS[String(sort) as keyof typeof SORT_OPTIONS]) || SORT_OPTIONS.newest;

  const listings = await prisma.listing.findMany({
    where: {
      ...(category ? { category: String(category) } : {}),
      ...(sellerId ? { sellerId: String(sellerId) } : {}),
      ...(country ? { country: String(country) } : {}),
      ...(yearFilter ? { year: yearFilter } : {}),
      ...(priceFilter ? { price: priceFilter } : {}),
      status: effectiveStatus as any,
    },
    orderBy,
    include: { seller: { select: { id: true, name: true } } },
  });

  res.json(listings);
}));

// GET /listings/filters - options for building a filter UI: every country
// currently in use among active listings, the oldest/newest year among
// them (so a UI can offer a sensible decade range), the highest price (so a
// UI can offer $100-wide price bands up to that point), and the fixed
// category taxonomy. Kept dynamic for country/year/price so the filters
// never show an option with zero matching results.
listingsRouter.get('/filters', asyncHandler(async (_req, res) => {
  const [countries, yearRange, priceRange] = await Promise.all([
    prisma.listing.findMany({
      where: { status: 'ACTIVE', country: { not: null } },
      select: { country: true },
      distinct: ['country'],
      orderBy: { country: 'asc' },
    }),
    prisma.listing.aggregate({
      where: { status: 'ACTIVE', year: { not: null } },
      _min: { year: true },
      _max: { year: true },
    }),
    prisma.listing.aggregate({
      where: { status: 'ACTIVE' },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  res.json({
    categories: LISTING_CATEGORIES,
    countries: countries.map((c) => c.country).filter((c): c is string => !!c),
    minYear: yearRange._min.year,
    maxYear: yearRange._max.year,
    minPrice: priceRange._min.price ? Number(priceRange._min.price) : null,
    maxPrice: priceRange._max.price ? Number(priceRange._max.price) : null,
  });
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

const CURRENT_YEAR = new Date().getFullYear();

function validateYear(year: unknown): number | null | undefined {
  if (year === undefined) return undefined; // not provided - leave unchanged
  if (year === null || year === '') return null; // explicitly cleared
  const parsed = typeof year === 'number' ? year : parseInt(String(year), 10);
  if (Number.isNaN(parsed) || parsed < 1000 || parsed > CURRENT_YEAR) {
    return undefined; // invalid - ignore rather than 400, this field is optional/cosmetic
  }
  return parsed;
}

// POST /listings - create a new listing (draft). Seller is taken from the
// authenticated session, never trusted from the request body.
listingsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { title, description, category, price, images, aiGenerated, allowBidding, year, country } = req.body;

  if (!title || !description || !category || price == null) {
    return res.status(400).json({ error: { message: 'Missing required listing fields' } });
  }

  const validatedYear = validateYear(year);

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
      ...(validatedYear !== undefined ? { year: validatedYear } : {}),
      ...(country ? { country: String(country).trim().slice(0, 100) } : {}),
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

  const { title, description, category, price, images, allowBidding, year, country } = req.body;
  // NOTE: status is intentionally not editable here - it only transitions via
  // /publish (DRAFT -> ACTIVE, which also sets up the free-hosting-month
  // fields) and DELETE (-> REMOVED). Allowing it here would let a seller skip
  // that setup or reactivate a listing that already sold.

  const validatedYear = validateYear(year);

  const listing = await prisma.listing.update({
    where: { id: String(req.params.id) },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(allowBidding !== undefined ? { allowBidding } : {}),
      ...(validatedYear !== undefined ? { year: validatedYear } : {}),
      ...(country !== undefined ? { country: country ? String(country).trim().slice(0, 100) : null } : {}),
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
