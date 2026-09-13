import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendEmail, listingExpiryWarningBody } from '../lib/email.js';

export const maintenanceRouter = Router();

const WARNING_WINDOW_DAYS = 3; // warn when free hosting has this many days or fewer left
const PAUSE_GRACE_DAYS = 30; // paused listings are removed after this many days

// TODO: set once the web deep-link is stable - used in the expiry warning email.
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// POST /admin/maintenance - runs the two scheduled housekeeping tasks:
//  1. Email sellers whose listings are close to the end of free hosting
//     (only once per listing, tracked via expiryWarningSentAt)
//  2. Remove listings that have been paused for 30+ days without being
//     resumed
//
// This is not wired to run automatically by itself - something external
// needs to call it on a schedule. See .github/workflows/listing-maintenance.yml
// for a free daily trigger via GitHub Actions, which is what this project
// uses instead of paying for Render's Cron Jobs add-on.
//
// Protected by a shared secret rather than a full admin-auth system, since
// there's no admin role concept in the app yet - this is deliberately the
// simplest thing that keeps the endpoint from being callable by anyone who
// finds the URL.
maintenanceRouter.post('/admin/maintenance', asyncHandler(async (req, res) => {
  const providedSecret = req.headers['x-maintenance-secret'];
  const expectedSecret = process.env.MAINTENANCE_SECRET;

  if (!expectedSecret) {
    return res.status(500).json({ error: { message: 'MAINTENANCE_SECRET is not configured on the server' } });
  }
  if (providedSecret !== expectedSecret) {
    return res.status(401).json({ error: { message: 'Invalid maintenance secret' } });
  }

  // --- Task 1: expiry warnings ---
  const warningCutoff = new Date(Date.now() + WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const listingsNearingExpiry = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      freeUntil: { not: null, lte: warningCutoff },
      expiryWarningSentAt: null,
    },
    include: { seller: { select: { id: true, email: true } } },
  });

  let warningsSent = 0;
  for (const listing of listingsNearingExpiry) {
    if (!listing.freeUntil) continue;
    const daysLeft = Math.max(0, Math.ceil((listing.freeUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

    await sendEmail(
      listing.seller.email,
      `Your listing "${listing.title}" is nearing the end of free hosting`,
      listingExpiryWarningBody(listing.title, daysLeft, `${APP_URL}/my-listings`)
    );

    await prisma.listing.update({ where: { id: listing.id }, data: { expiryWarningSentAt: new Date() } });
    warningsSent += 1;
  }

  // --- Task 2: remove long-paused listings ---
  const pauseCutoff = new Date(Date.now() - PAUSE_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const removedResult = await prisma.listing.updateMany({
    where: { status: 'PAUSED', pausedAt: { not: null, lte: pauseCutoff } },
    data: { status: 'REMOVED' },
  });

  res.json({
    warningsSent,
    listingsRemoved: removedResult.count,
    ranAt: new Date().toISOString(),
  });
}));
