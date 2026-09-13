import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY && process.env.NODE_ENV !== 'test') {
  console.warn('WARNING: STRIPE_SECRET_KEY is not set. Payment routes will fail until it is configured.');
}

// Using a dummy placeholder key when unset lets the app boot in dev without
// Stripe configured yet; actual calls will fail with a clear Stripe error
// rather than crashing at import time.
export const stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_test_placeholder_not_configured', {
  apiVersion: '2026-08-26.dahlia',
});
