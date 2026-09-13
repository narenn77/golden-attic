import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { listingsRouter } from './routes/listings.js';
import { bidsRouter } from './routes/bids.js';
import { ordersRouter } from './routes/orders.js';
import { usersRouter } from './routes/users.js';
import { authRouter } from './routes/auth.js';
import { paymentsRouter, handleStripeWebhook } from './routes/payments.js';
import { aiListingRouter } from './routes/aiListing.js';
import { conversationsRouter } from './routes/conversations.js';
import { ratingsRouter } from './routes/ratings.js';
import { errorHandler } from './middleware/errorHandler.js';

// Builds the Express app without starting a listener - this is what both
// the real server entrypoint (index.ts) and the test suite import, so tests
// exercise the exact same middleware stack and routes as production.
export function createApp() {
  const app = express();

  // When deployed behind a reverse proxy/load balancer (Render, Heroku, an ALB,
  // etc.), Express needs to know to trust the X-Forwarded-For header - otherwise
  // every request appears to come from the proxy's IP, and IP-based rate
  // limiting (see auth.ts) would apply to all users collectively instead of
  // per-client. Only enable this when actually behind a trusted proxy.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cors());

  // The Stripe webhook needs the exact raw request bytes to verify the
  // signature, so it must be registered BEFORE express.json() and must not
  // go through the JSON body parser.
  app.post('/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

  app.use(express.json({ limit: '50mb' })); // AI listing drafts send base64 images

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/listings', listingsRouter);
  app.use('/listings', aiListingRouter);
  app.use('/bids', bidsRouter);
  app.use('/orders', ordersRouter);
  app.use('/payments', paymentsRouter);
  app.use('/conversations', conversationsRouter);
  app.use('/', ratingsRouter);

  app.use(errorHandler);

  return app;
}
