import { describe, it, expect } from 'vitest';
import { testAgent } from '../helpers/agent.js';
import { createTestUser, createOnboardedSeller, createTestListing, createTestBid } from '../helpers/factories.js';
import { createdPaymentIntents, stripeAccountState } from '../helpers/mocks/stripe.js';
import { prisma } from '../../src/lib/prisma.js';

describe('functional: creating orders', () => {
  it('requires auth to create an order', async () => {
    const seller = await createOnboardedSeller();
    const listing = await createTestListing(seller.id, { price: 100 });

    const res = await testAgent().post('/orders').send({ listingId: listing.id });
    expect(res.status).toBe(401);
  });

  it('creates an order at the listing price for a direct purchase', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 150 });

    const res = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({
      listingId: listing.id,
    });

    expect(res.status).toBe(201);
    expect(Number(res.body.amount)).toBe(150);
    expect(Number(res.body.commissionAmount)).toBeCloseTo(7.5, 2); // 5% of 150
    expect(Number(res.body.sellerPayoutAmount)).toBeCloseTo(142.5, 2);
    expect(res.body.status).toBe('PENDING_PAYMENT');
  });

  it('does not let a seller buy their own listing', async () => {
    const seller = await createOnboardedSeller();
    const listing = await createTestListing(seller.id, { price: 100 });

    const res = await testAgent().post('/orders').set('Authorization', `Bearer ${seller.token}`).send({
      listingId: listing.id,
    });

    expect(res.status).toBe(400);
  });

  it('rejects ordering a listing that is not active', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { status: 'SOLD' });

    const res = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({
      listingId: listing.id,
    });

    expect(res.status).toBe(400);
  });

  it('rejects a second concurrent order on the same listing', async () => {
    const seller = await createOnboardedSeller();
    const buyerA = await createTestUser();
    const buyerB = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });

    const first = await testAgent().post('/orders').set('Authorization', `Bearer ${buyerA.token}`).send({ listingId: listing.id });
    expect(first.status).toBe(201);

    const second = await testAgent().post('/orders').set('Authorization', `Bearer ${buyerB.token}`).send({ listingId: listing.id });
    expect(second.status).toBe(409);
  });

  it('allows a new order once a prior pending one is stale (30+ minutes old)', async () => {
    const seller = await createOnboardedSeller();
    const buyerA = await createTestUser();
    const buyerB = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });

    const first = await testAgent().post('/orders').set('Authorization', `Bearer ${buyerA.token}`).send({ listingId: listing.id });
    expect(first.status).toBe(201);

    // Backdate the order's createdAt to simulate an abandoned checkout.
    await prisma.order.update({
      where: { id: first.body.id },
      data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) },
    });

    const second = await testAgent().post('/orders').set('Authorization', `Bearer ${buyerB.token}`).send({ listingId: listing.id });
    expect(second.status).toBe(201);
  });

  it("SECURITY REGRESSION: ignores a client-supplied amount and always uses the listing's real price", async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 500 });

    const res = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({
      listingId: listing.id,
      amount: 0.01, // attempted price tampering
    });

    expect(res.status).toBe(201);
    expect(Number(res.body.amount)).toBe(500); // not 0.01
  });

  it('does not flip the listing to SOLD merely from an order being created (only on confirmed payment)', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });

    await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const listingCheck = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(listingCheck?.status).toBe('ACTIVE');
  });
});

describe('functional: checking out at a negotiated bid price', () => {
  it("creates an order at the seller's counter-offer amount when checking out via an accepted bid", async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const bid = await createTestBid(listing.id, buyer.id, { amount: 80, status: 'ACCEPTED', counterAmount: 85 });

    const res = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({
      listingId: listing.id, bidId: bid.id,
    });

    expect(res.status).toBe(201);
    expect(Number(res.body.amount)).toBe(85); // counter-offer, not the original bid or listing price
  });

  it('rejects checkout via a bid that is not accepted', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const bid = await createTestBid(listing.id, buyer.id, { amount: 80, status: 'PENDING' });

    const res = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({
      listingId: listing.id, bidId: bid.id,
    });

    expect(res.status).toBe(400);
  });

  it("rejects checkout via someone else's accepted bid", async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const impersonator = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const bid = await createTestBid(listing.id, buyer.id, { amount: 80, status: 'ACCEPTED' });

    const res = await testAgent().post('/orders').set('Authorization', `Bearer ${impersonator.token}`).send({
      listingId: listing.id, bidId: bid.id,
    });

    expect(res.status).toBe(403);
  });
});

describe('functional: viewing orders', () => {
  it("lets the buyer view their own order", async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const created = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const res = await testAgent().get(`/orders/${created.body.id}`).set('Authorization', `Bearer ${buyer.token}`);
    expect(res.status).toBe(200);
  });

  it("lets the seller view an order on their listing", async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const created = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const res = await testAgent().get(`/orders/${created.body.id}`).set('Authorization', `Bearer ${seller.token}`);
    expect(res.status).toBe(200);
  });

  it('SECURITY REGRESSION: does not let an unrelated user view someone else\'s order', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const stranger = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const created = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const res = await testAgent().get(`/orders/${created.body.id}`).set('Authorization', `Bearer ${stranger.token}`);
    expect(res.status).toBe(403);
  });

  it('SECURITY REGRESSION: requires auth to view an order at all', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const created = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const res = await testAgent().get(`/orders/${created.body.id}`);
    expect(res.status).toBe(401);
  });

  it('SECURITY REGRESSION: GET /orders only ever returns the caller\'s own orders', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const stranger = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const res = await testAgent().get('/orders').set('Authorization', `Bearer ${stranger.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('SECURITY REGRESSION: the dangerous unauthenticated PATCH /orders/:id/status endpoint no longer exists', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const created = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const res = await testAgent().patch(`/orders/${created.body.id}/status`).send({ status: 'PAID' });
    expect(res.status).toBe(404); // no such route anymore

    const dbOrder = await prisma.order.findUnique({ where: { id: created.body.id } });
    expect(dbOrder?.status).toBe('PENDING_PAYMENT'); // definitely not silently marked PAID
  });
});

describe('functional: Stripe Connect onboarding', () => {
  it('creates a connect account and returns an onboarding link', async () => {
    const seller = await createTestUser();

    const res = await testAgent().post('/payments/connect/onboard').set('Authorization', `Bearer ${seller.token}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('stripe');
  });

  it('reports not-onboarded status before any connect account exists', async () => {
    const seller = await createTestUser();

    const res = await testAgent().get('/payments/connect/status').set('Authorization', `Bearer ${seller.token}`);

    expect(res.status).toBe(200);
    expect(res.body.onboarded).toBe(false);
  });

  it('reports fully-onboarded status once Stripe confirms charges/payouts are enabled', async () => {
    const seller = await createOnboardedSeller();
    stripeAccountState.chargesEnabled = true;
    stripeAccountState.payoutsEnabled = true;

    const res = await testAgent().get('/payments/connect/status').set('Authorization', `Bearer ${seller.token}`);

    expect(res.status).toBe(200);
    expect(res.body.chargesEnabled).toBe(true);
    expect(res.body.payoutsEnabled).toBe(true);
  });
});

describe('functional: checkout (PaymentIntent creation)', () => {
  it("creates a PaymentIntent with the correct amount and platform commission as the application fee", async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 200 });
    const order = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const res = await testAgent().post('/payments/checkout').set('Authorization', `Bearer ${buyer.token}`).send({
      orderId: order.body.id,
    });

    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBeTruthy();

    const pi = createdPaymentIntents.at(-1);
    expect(pi.amount).toBe(20000); // $200 in cents
    expect(pi.application_fee_amount).toBe(1000); // 5% commission in cents
  });

  it("does not let someone else check out another buyer's order", async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const attacker = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 200 });
    const order = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const res = await testAgent().post('/payments/checkout').set('Authorization', `Bearer ${attacker.token}`).send({
      orderId: order.body.id,
    });

    expect(res.status).toBe(403);
  });

  it('rejects checkout if the seller has not completed Stripe onboarding', async () => {
    const seller = await createTestUser(); // no stripeConnectAccountId
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 200 });
    const order = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });

    const res = await testAgent().post('/payments/checkout').set('Authorization', `Bearer ${buyer.token}`).send({
      orderId: order.body.id,
    });

    expect(res.status).toBe(400);
  });
});

describe('functional: Stripe webhook', () => {
  it('marks an order PAID and the listing SOLD on payment_intent.succeeded', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const order = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });
    await testAgent().post('/payments/checkout').set('Authorization', `Bearer ${buyer.token}`).send({ orderId: order.body.id });

    const pi = createdPaymentIntents.at(-1);
    const event = {
      type: 'payment_intent.succeeded',
      data: { object: { id: pi.id, metadata: { orderId: order.body.id, listingId: listing.id } } },
    };

    const res = await testAgent()
      .post('/payments/webhook')
      .set('stripe-signature', 'valid-test-signature')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    expect(res.status).toBe(200);

    const dbOrder = await prisma.order.findUnique({ where: { id: order.body.id } });
    const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(dbOrder?.status).toBe('PAID');
    expect(dbListing?.status).toBe('SOLD');
  });

  it('cancels the order on payment_intent.payment_failed without needing to reopen the listing', async () => {
    const seller = await createOnboardedSeller();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const order = await testAgent().post('/orders').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id });
    await testAgent().post('/payments/checkout').set('Authorization', `Bearer ${buyer.token}`).send({ orderId: order.body.id });

    const pi = createdPaymentIntents.at(-1);
    const event = {
      type: 'payment_intent.payment_failed',
      data: { object: { id: pi.id, metadata: { orderId: order.body.id } } },
    };

    const res = await testAgent()
      .post('/payments/webhook')
      .set('stripe-signature', 'valid-test-signature')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    expect(res.status).toBe(200);

    const dbOrder = await prisma.order.findUnique({ where: { id: order.body.id } });
    const dbListing = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(dbOrder?.status).toBe('CANCELLED');
    expect(dbListing?.status).toBe('ACTIVE'); // was never SOLD in the first place
  });

  it('rejects a webhook with an invalid signature', async () => {
    const res = await testAgent()
      .post('/payments/webhook')
      .set('stripe-signature', 'invalid-signature')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'payment_intent.succeeded', data: { object: {} } }));

    expect(res.status).toBe(400);
  });
});
