import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { stripe } from '../lib/stripe.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const paymentsRouter = Router();

const PLATFORM_COMMISSION_RATE = 0.05; // 5% of sale price - decided

// TODO: set once the web/mobile onboarding return screens exist.
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ---------- Seller onboarding (Stripe Connect Express) ----------

// POST /payments/connect/onboard - creates (if needed) a Stripe Connect Express
// account for the current user and returns a one-time onboarding link.
paymentsRouter.post('/connect/onboard', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });

  let accountId = user.stripeConnectAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;

    await prisma.user.update({
      where: { id: user.id },
      data: { stripeConnectAccountId: accountId },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/seller/onboarding/refresh`,
    return_url: `${APP_URL}/seller/onboarding/complete`,
    type: 'account_onboarding',
  });

  res.json({ url: accountLink.url });
}));

// GET /payments/connect/status - has the current user finished onboarding
// (i.e. can they actually receive payouts)?
paymentsRouter.get('/connect/status', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });

  if (!user.stripeConnectAccountId) {
    return res.json({ onboarded: false, chargesEnabled: false, payoutsEnabled: false });
  }

  const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

  res.json({
    onboarded: true,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });
}));

// ---------- Buyer checkout ----------

// POST /payments/checkout - creates a PaymentIntent for buying a listing.
// Uses a destination charge: the full amount is charged to the buyer, Stripe
// automatically routes (amount - commission) to the seller's connected
// account, and the platform keeps the application fee.
paymentsRouter.post('/checkout', requireAuth, asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: { message: 'orderId is required' } });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { seller: true },
  });

  if (!order) return res.status(404).json({ error: { message: 'Order not found' } });
  if (order.buyerId !== req.user!.userId) {
    return res.status(403).json({ error: { message: 'Not your order' } });
  }
  if (order.status !== 'PENDING_PAYMENT') {
    return res.status(400).json({ error: { message: `Order is not payable (status: ${order.status})` } });
  }
  if (!order.seller.stripeConnectAccountId) {
    return res.status(400).json({ error: { message: 'Seller has not completed payment onboarding yet' } });
  }

  const totalCents = Math.round((Number(order.amount) + Number(order.shippingCost ?? 0)) * 100);
  const commissionInCents = Math.round(Number(order.commissionAmount) * 100); // commission is on item price only, never shipping

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    application_fee_amount: commissionInCents,
    transfer_data: {
      destination: order.seller.stripeConnectAccountId,
    },
    metadata: {
      orderId: order.id,
      listingId: order.listingId,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  res.json({ clientSecret: paymentIntent.client_secret });
}));

// ---------- Stripe webhook ----------
// NOTE: this router must be mounted with express.raw() (not express.json())
// so the signature can be verified against the exact request bytes. See index.ts.

export async function handleStripeWebhook(req: import('express').Request, res: import('express').Response) {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).send('Missing signature or webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as import('stripe').Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.orderId;
      if (orderId) {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: 'PAID', stripePaymentIntentId: paymentIntent.id },
        });
        // The listing only becomes unavailable once payment is actually confirmed.
        await prisma.listing.update({
          where: { id: order.listingId },
          data: { status: 'SOLD', soldAt: new Date() },
        });
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as import('stripe').Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.orderId;
      if (orderId) {
        // Listing was never flipped to SOLD for this order (that only happens
        // on confirmed payment), so there's nothing to reopen - just mark the
        // failed attempt as cancelled.
        await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
      }
      break;
    }
    default:
      // Unhandled event types are fine to ignore.
      break;
  }

  res.json({ received: true });
}
