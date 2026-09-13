import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { LISTING_CATEGORIES } from '@golden-attic/shared';
import { calculateShippingRate, isLikelyLocalPickup } from '../lib/shipping.js';

export const listingsRouter = Router();

const SORT_OPTIONS = {
  newest: { createdAt: 'desc' as const },
  oldest: { createdAt: 'asc' as const },
  price_asc: { price: 'asc' as const },
  price_desc: { price: 'desc' as const },
  year_newest: { year: 'desc' as const },
  year_oldest: { year: 'asc' as const },
};

// Reshapes a listing fetched with `_count.likes` (and optionally
// `_count.bids`, only requested for the owner's own listings) plus an
// optional filtered `likes` relation (containing at most the current
// user's own like row) into flat fields, dropping the internal ones.
function shapeListingWithLikes<T extends { _count?: { likes: number; bids?: number }; likes?: unknown[] }>(
  listing: T
): Omit<T, '_count' | 'likes'> & { likeCount: number; likedByMe: boolean; pendingBidCount?: number } {
  const { _count, likes, ...rest } = listing;
  return {
    ...rest,
    likeCount: _count?.likes ?? 0,
    likedByMe: Array.isArray(likes) && likes.length > 0,
    ...(_count?.bids !== undefined ? { pendingBidCount: _count.bids } : {}),
  };
}

// GET /listings - browse active listings.
// Filters: category, country (each accepts a single value or a
// comma-separated list for multi-select, e.g. category=Stamps,Coins),
// decade (a "decade" param like "1950" matches years 1950-1959 inclusive),
// minPrice/maxPrice (e.g. band filters in $100 increments - a UI can send
// minPrice=100&maxPrice=200 for "$100-$200").
// Sort: one of newest (default), oldest, price_asc, price_desc,
// year_newest, year_oldest, most_liked.
// A non-ACTIVE status filter (DRAFT, PAUSED, REMOVED, etc.) - including the
// special value ALL - is only honored when the caller is asking about their
// own listings (status=ALL is how a seller's "My Listings" view sees every
// status at once) - otherwise a seller's unpublished/paused/removed
// listings would be publicly browsable.
listingsRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { category, sellerId, status, country, decade, minPrice, maxPrice, sort } = req.query;

  const requestedStatus = status ? String(status) : 'ACTIVE';
  const isOwnListings = !!sellerId && req.user?.userId === String(sellerId);
  const effectiveStatus = requestedStatus === 'ACTIVE' || isOwnListings ? requestedStatus : 'ACTIVE';

  const categoryList = category ? String(category).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const countryList = country ? String(country).split(',').map((s) => s.trim()).filter(Boolean) : [];

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

  const isMostLiked = sort === 'most_liked';
  const orderBy = isMostLiked
    ? undefined // handled by a separate sort pass below, since it's not a plain column
    : (sort && SORT_OPTIONS[String(sort) as keyof typeof SORT_OPTIONS]) || SORT_OPTIONS.newest;

  const listings = await prisma.listing.findMany({
    where: {
      ...(categoryList.length === 1 ? { category: categoryList[0] } : categoryList.length > 1 ? { category: { in: categoryList } } : {}),
      ...(sellerId ? { sellerId: String(sellerId) } : {}),
      ...(countryList.length === 1 ? { country: countryList[0] } : countryList.length > 1 ? { country: { in: countryList } } : {}),
      ...(yearFilter ? { year: yearFilter } : {}),
      ...(priceFilter ? { price: priceFilter } : {}),
      ...(effectiveStatus === 'ALL' ? {} : { status: effectiveStatus as any }),
    },
    ...(orderBy ? { orderBy } : {}),
    include: {
      seller: { select: { id: true, name: true } },
      _count: {
        select: {
          likes: true,
          ...(isOwnListings ? { bids: { where: { status: 'PENDING' } } } : {}),
        },
      },
      ...(req.user ? { likes: { where: { userId: req.user.userId }, select: { id: true } } } : {}),
    },
  });

  let shaped = listings.map(shapeListingWithLikes);
  if (isMostLiked) {
    shaped = shaped.sort((a, b) => b.likeCount - a.likeCount);
  }

  res.json(shaped);
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
      _count: { select: { likes: true } },
      ...(req.user ? { likes: { where: { userId: req.user.userId }, select: { id: true } } } : {}),
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

  res.json({ ...shapeListingWithLikes(listing), bids: visibleBids });
}));

// GET /listings/:id/shipping-quote - estimated shipping cost to the
// current user's saved address (or a supplied postalCode/city/state
// override), plus whether local pickup looks plausible based on proximity
// to the seller. This is a preview only - the actual order stores whatever
// was true at checkout time.
listingsRouter.get('/:id/shipping-quote', requireAuth, asyncHandler(async (req, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: String(req.params.id) } });
  if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });

  const seller = await prisma.user.findUnique({ where: { id: listing.sellerId } });
  const buyer = await prisma.user.findUnique({ where: { id: req.user!.userId } });

  const destination = {
    city: (req.query.city as string) || buyer?.city || null,
    state: (req.query.state as string) || buyer?.state || null,
    postalCode: (req.query.postalCode as string) || buyer?.postalCode || null,
  };

  const rate = calculateShippingRate(listing.weightOz);
  const localPickupEligible = isLikelyLocalPickup(destination, {
    city: seller?.city, state: seller?.state, postalCode: seller?.postalCode,
  });

  res.json({
    shippingCost: rate.cost,
    service: rate.service,
    estimated: rate.estimated,
    localPickupEligible,
    sellerCity: seller?.city ?? null,
    sellerState: seller?.state ?? null,
  });
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
  const { title, description, category, price, images, aiGenerated, allowBidding, year, country, weightOz } = req.body;

  if (!title || !description || !category || price == null) {
    return res.status(400).json({ error: { message: 'Missing required listing fields' } });
  }

  const validatedYear = validateYear(year);
  const validatedWeight = typeof weightOz === 'number' && weightOz > 0 ? Math.round(weightOz) : undefined;

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
      ...(validatedWeight !== undefined ? { weightOz: validatedWeight } : {}),
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

// POST /listings/:id/pause - hide an ACTIVE listing from browsing without
// deleting it. Paused listings are auto-removed after a grace period if
// never resumed (see the maintenance job discussed in DEPLOYMENT.md).
listingsRouter.post('/:id/pause', requireAuth, asyncHandler(async (req, res) => {
  const existing = await prisma.listing.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (existing.sellerId !== req.user!.userId) {
    return res.status(403).json({ error: { message: 'Not your listing' } });
  }
  if (existing.status !== 'ACTIVE') {
    return res.status(400).json({ error: { message: `Cannot pause a listing with status ${existing.status}` } });
  }

  const listing = await prisma.listing.update({
    where: { id: String(req.params.id) },
    data: { status: 'PAUSED', pausedAt: new Date() },
  });

  res.json(listing);
}));

// POST /listings/:id/resume - bring a PAUSED listing back to ACTIVE. The
// original free-hosting/paid-through dates are left untouched (time spent
// paused still counts against them - see PATCH docs below for rationale).
listingsRouter.post('/:id/resume', requireAuth, asyncHandler(async (req, res) => {
  const existing = await prisma.listing.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (existing.sellerId !== req.user!.userId) {
    return res.status(403).json({ error: { message: 'Not your listing' } });
  }
  if (existing.status !== 'PAUSED') {
    return res.status(400).json({ error: { message: `Cannot resume a listing with status ${existing.status}` } });
  }

  const listing = await prisma.listing.update({
    where: { id: String(req.params.id) },
    data: { status: 'ACTIVE', pausedAt: null },
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

  const { title, description, category, price, images, allowBidding, year, country, weightOz } = req.body;
  // NOTE: status is intentionally not editable here - it only transitions via
  // /publish (DRAFT -> ACTIVE, which also sets up the free-hosting-month
  // fields) and DELETE (-> REMOVED). Allowing it here would let a seller skip
  // that setup or reactivate a listing that already sold.

  const validatedYear = validateYear(year);
  const validatedWeight = typeof weightOz === 'number' && weightOz > 0 ? Math.round(weightOz) : weightOz === null ? null : undefined;

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
      ...(validatedWeight !== undefined ? { weightOz: validatedWeight } : {}),
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

// ---------- Likes / Saves ----------

// POST /listings/:id/like
listingsRouter.post('/:id/like', requireAuth, asyncHandler(async (req, res) => {
  const listing = await prisma.listing.findUnique({ where: { id: String(req.params.id) } });
  if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (listing.sellerId === req.user!.userId) {
    return res.status(400).json({ error: { message: 'You cannot like your own listing' } });
  }

  // Idempotent: liking something already liked just succeeds quietly,
  // rather than erroring on the unique constraint.
  await prisma.like.upsert({
    where: { userId_listingId: { userId: req.user!.userId, listingId: listing.id } },
    create: { userId: req.user!.userId, listingId: listing.id },
    update: {},
  });

  const likeCount = await prisma.like.count({ where: { listingId: listing.id } });
  res.json({ liked: true, likeCount });
}));

// DELETE /listings/:id/like
listingsRouter.delete('/:id/like', requireAuth, asyncHandler(async (req, res) => {
  await prisma.like.deleteMany({ where: { userId: req.user!.userId, listingId: String(req.params.id) } });
  const likeCount = await prisma.like.count({ where: { listingId: String(req.params.id) } });
  res.json({ liked: false, likeCount });
}));

// GET /listings/liked/mine - the current user's saved/liked listings
listingsRouter.get('/liked/mine', requireAuth, asyncHandler(async (req, res) => {
  const likes = await prisma.like.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: {
        include: {
          seller: { select: { id: true, name: true } },
          _count: { select: { likes: true } },
        },
      },
    },
  });

  const listings = likes
    .map((like) => ({ ...like.listing, likedByMe: true }))
    .map(shapeListingWithLikes);

  res.json(listings);
}));
