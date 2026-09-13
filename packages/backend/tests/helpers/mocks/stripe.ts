import { vi } from 'vitest';

// Configurable per-test behavior for the Stripe connected-account status
// check (charges_enabled / payouts_enabled), since many tests need a
// "fully onboarded seller" and a few specifically need a "not yet onboarded"
// seller.
export const stripeAccountState = {
  chargesEnabled: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
};

export function resetStripeMockState() {
  stripeAccountState.chargesEnabled = true;
  stripeAccountState.payoutsEnabled = true;
  stripeAccountState.detailsSubmitted = true;
}

let acctCounter = 0;
let piCounter = 0;

// Captures every PaymentIntent "created" during a test, so tests can assert
// on amount/application_fee_amount/destination without hitting real Stripe.
export const createdPaymentIntents: any[] = [];

export const stripe = {
  accounts: {
    create: vi.fn(async (_params: any) => {
      acctCounter += 1;
      return { id: `acct_test_${acctCounter}` };
    }),
    retrieve: vi.fn(async (_id: string) => ({
      charges_enabled: stripeAccountState.chargesEnabled,
      payouts_enabled: stripeAccountState.payoutsEnabled,
      details_submitted: stripeAccountState.detailsSubmitted,
    })),
  },
  accountLinks: {
    create: vi.fn(async (_params: any) => ({
      url: 'https://connect.stripe.test/onboarding/mock',
    })),
  },
  paymentIntents: {
    create: vi.fn(async (params: any) => {
      piCounter += 1;
      const id = `pi_test_${piCounter}`;
      createdPaymentIntents.push({ id, ...params });
      return { id, client_secret: `${id}_secret_test` };
    }),
  },
  webhooks: {
    // Real signature verification is exercised in a dedicated test with a
    // deliberately-invalid signature; for everything else, tests construct
    // the "event" they want directly rather than a raw signed payload.
    constructEvent: vi.fn((rawBody: any, signature: any) => {
      if (signature === 'invalid-signature') {
        throw new Error('No signatures found matching the expected signature for payload');
      }
      return JSON.parse(rawBody.toString());
    }),
  },
};
