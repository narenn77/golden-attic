import { describe, it, expect } from 'vitest';
import { testAgent } from '../helpers/agent.js';
import { createTestUser, createTestListing, createTestBid } from '../helpers/factories.js';

describe('functional: placing bids', () => {
  it('requires auth to place a bid', async () => {
    const seller = await createTestUser();
    const listing = await createTestListing(seller.id);

    const res = await testAgent().post('/bids').send({ listingId: listing.id, amount: 50 });
    expect(res.status).toBe(401);
  });

  it('places a bid on an active, bidding-enabled listing', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });

    const res = await testAgent().post('/bids').set('Authorization', `Bearer ${buyer.token}`).send({
      listingId: listing.id, amount: 80,
    });

    expect(res.status).toBe(201);
    expect(res.body.bidderId).toBe(buyer.id);
    expect(Number(res.body.amount)).toBe(80);
    expect(res.body.status).toBe('PENDING');
  });

  it('rejects a non-positive bid amount', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id);

    const zero = await testAgent().post('/bids').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id, amount: 0 });
    const negative = await testAgent().post('/bids').set('Authorization', `Bearer ${buyer.token}`).send({ listingId: listing.id, amount: -5 });

    expect(zero.status).toBe(400);
    expect(negative.status).toBe(400);
  });

  it('does not allow a seller to bid on their own listing', async () => {
    const seller = await createTestUser();
    const listing = await createTestListing(seller.id);

    const res = await testAgent().post('/bids').set('Authorization', `Bearer ${seller.token}`).send({
      listingId: listing.id, amount: 50,
    });

    expect(res.status).toBe(400);
  });

  it('rejects a bid when bidding is disabled on the listing', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { allowBidding: false });

    const res = await testAgent().post('/bids').set('Authorization', `Bearer ${buyer.token}`).send({
      listingId: listing.id, amount: 50,
    });

    expect(res.status).toBe(400);
  });

  it('rejects a bid on a non-active listing', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { status: 'SOLD' });

    const res = await testAgent().post('/bids').set('Authorization', `Bearer ${buyer.token}`).send({
      listingId: listing.id, amount: 50,
    });

    expect(res.status).toBe(400);
  });
});

describe('functional: countering, accepting, rejecting bids', () => {
  it('lets the seller counter a pending bid', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id, { price: 100 });
    const bid = await createTestBid(listing.id, buyer.id, { amount: 70 });

    const res = await testAgent().post(`/bids/${bid.id}/counter`).set('Authorization', `Bearer ${seller.token}`).send({
      counterAmount: 85,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COUNTERED');
    expect(Number(res.body.counterAmount)).toBe(85);
  });

  it('does not let the bidder counter their own bid', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id);
    const bid = await createTestBid(listing.id, buyer.id);

    const res = await testAgent().post(`/bids/${bid.id}/counter`).set('Authorization', `Bearer ${buyer.token}`).send({
      counterAmount: 85,
    });

    expect(res.status).toBe(403);
  });

  it('lets the buyer accept a countered offer', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id);
    const bid = await createTestBid(listing.id, buyer.id, { status: 'COUNTERED', counterAmount: 85 });

    const res = await testAgent().post(`/bids/${bid.id}/accept`).set('Authorization', `Bearer ${buyer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCEPTED');
  });

  it('lets the seller directly accept a pending bid (no counter needed)', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id);
    const bid = await createTestBid(listing.id, buyer.id, { status: 'PENDING' });

    const res = await testAgent().post(`/bids/${bid.id}/accept`).set('Authorization', `Bearer ${seller.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCEPTED');
  });

  it('does not let an unrelated user accept/reject a bid', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const stranger = await createTestUser();
    const listing = await createTestListing(seller.id);
    const bid = await createTestBid(listing.id, buyer.id);

    const acceptRes = await testAgent().post(`/bids/${bid.id}/accept`).set('Authorization', `Bearer ${stranger.token}`);
    const rejectRes = await testAgent().post(`/bids/${bid.id}/reject`).set('Authorization', `Bearer ${stranger.token}`);

    expect(acceptRes.status).toBe(403);
    expect(rejectRes.status).toBe(403);
  });

  it('does not allow accepting an already-rejected bid', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id);
    const bid = await createTestBid(listing.id, buyer.id, { status: 'REJECTED' });

    const res = await testAgent().post(`/bids/${bid.id}/accept`).set('Authorization', `Bearer ${buyer.token}`);
    expect(res.status).toBe(400);
  });
});

describe('regression: bid visibility is private, not public', () => {
  it('does not expose other bidders\' bids to an unrelated authenticated user', async () => {
    const seller = await createTestUser();
    const buyerA = await createTestUser();
    const buyerB = await createTestUser();
    const listing = await createTestListing(seller.id);
    await createTestBid(listing.id, buyerA.id, { amount: 60 });

    const res = await testAgent().get(`/bids?listingId=${listing.id}`).set('Authorization', `Bearer ${buyerB.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('lets the seller see every bid on their own listing', async () => {
    const seller = await createTestUser();
    const buyerA = await createTestUser();
    const buyerB = await createTestUser();
    const listing = await createTestListing(seller.id);
    await createTestBid(listing.id, buyerA.id, { amount: 60 });
    await createTestBid(listing.id, buyerB.id, { amount: 70 });

    const res = await testAgent().get(`/bids?listingId=${listing.id}`).set('Authorization', `Bearer ${seller.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('lets a bidder see their own bid but not others\' on the same listing', async () => {
    const seller = await createTestUser();
    const buyerA = await createTestUser();
    const buyerB = await createTestUser();
    const listing = await createTestListing(seller.id);
    await createTestBid(listing.id, buyerA.id, { amount: 60 });
    await createTestBid(listing.id, buyerB.id, { amount: 70 });

    const res = await testAgent().get(`/bids?listingId=${listing.id}`).set('Authorization', `Bearer ${buyerA.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].bidderId).toBe(buyerA.id);
  });

  it('requires auth to list bids at all', async () => {
    const res = await testAgent().get('/bids');
    expect(res.status).toBe(401);
  });

  it('does not let a user query another user\'s bid history via bidderId', async () => {
    const buyerA = await createTestUser();
    const buyerB = await createTestUser();

    const res = await testAgent().get(`/bids?bidderId=${buyerB.id}`).set('Authorization', `Bearer ${buyerA.token}`);
    expect(res.status).toBe(403);
  });

  it('does not include other bidders\' bids in the public listing detail view', async () => {
    const seller = await createTestUser();
    const buyer = await createTestUser();
    const listing = await createTestListing(seller.id);
    await createTestBid(listing.id, buyer.id, { amount: 60 });

    const res = await testAgent().get(`/listings/${listing.id}`); // no auth at all
    expect(res.status).toBe(200);
    expect(res.body.bids).toHaveLength(0);
  });
});
