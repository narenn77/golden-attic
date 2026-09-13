import { describe, it, expect } from 'vitest';
import { testAgent } from '../helpers/agent.js';
import { createTestUser, createTestListing } from '../helpers/factories.js';

describe('functional: browsing listings', () => {
  it('lists active listings publicly with no auth required', async () => {
    const seller = await createTestUser();
    await createTestListing(seller.id, { title: 'Public Item' });

    const res = await testAgent().get('/listings');

    expect(res.status).toBe(200);
    expect(res.body.some((l: any) => l.title === 'Public Item')).toBe(true);
  });

  it('only returns ACTIVE listings by default (not draft/sold/removed)', async () => {
    const seller = await createTestUser();
    await createTestListing(seller.id, { title: 'Active One', status: 'ACTIVE' });
    await createTestListing(seller.id, { title: 'Draft One', status: 'DRAFT' });
    await createTestListing(seller.id, { title: 'Sold One', status: 'SOLD' });

    const res = await testAgent().get('/listings');
    const titles = res.body.map((l: any) => l.title);

    expect(titles).toContain('Active One');
    expect(titles).not.toContain('Draft One');
    expect(titles).not.toContain('Sold One');
  });

  it('filters by category', async () => {
    const seller = await createTestUser();
    await createTestListing(seller.id, { title: 'A Stamp', category: 'Stamps' });
    await createTestListing(seller.id, { title: 'A Coin', category: 'Coins' });

    const res = await testAgent().get('/listings?category=Stamps');
    const titles = res.body.map((l: any) => l.title);

    expect(titles).toContain('A Stamp');
    expect(titles).not.toContain('A Coin');
  });

  it('fetches a single listing by id', async () => {
    const seller = await createTestUser();
    const listing = await createTestListing(seller.id, { title: 'Single Item' });

    const res = await testAgent().get(`/listings/${listing.id}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Single Item');
    expect(res.body.seller.name).toBe(seller.name);
  });

  it('returns 404 for a nonexistent listing', async () => {
    const res = await testAgent().get('/listings/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('functional: creating and publishing listings', () => {
  it('requires auth to create a listing', async () => {
    const res = await testAgent().post('/listings').send({
      title: 'No Auth Item', description: 'desc', category: 'Other Collectibles', price: 10,
    });
    expect(res.status).toBe(401);
  });

  it('creates a listing as a draft, owned by the authenticated user', async () => {
    const seller = await createTestUser();

    const res = await testAgent().post('/listings').set('Authorization', `Bearer ${seller.token}`).send({
      title: 'My New Item', description: 'A fine item', category: 'Coins', price: 25,
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.sellerId).toBe(seller.id);
  });

  it('ignores a client-supplied sellerId and uses the authenticated user instead', async () => {
    const seller = await createTestUser();
    const otherUser = await createTestUser();

    const res = await testAgent().post('/listings').set('Authorization', `Bearer ${seller.token}`).send({
      title: 'Spoofed Seller Item', description: 'desc', category: 'Coins', price: 25,
      sellerId: otherUser.id, // should be ignored
    });

    expect(res.body.sellerId).toBe(seller.id);
    expect(res.body.sellerId).not.toBe(otherUser.id);
  });

  it('publishes a draft listing, setting the free hosting period', async () => {
    const seller = await createTestUser();
    const listing = await createTestListing(seller.id, { status: 'DRAFT' });

    const res = await testAgent().post(`/listings/${listing.id}/publish`).set('Authorization', `Bearer ${seller.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.freeUntil).toBeTruthy();
    expect(res.body.hostingPaidUntil).toBeTruthy();
  });

  it('does not allow a different user to publish someone else\'s listing', async () => {
    const seller = await createTestUser();
    const attacker = await createTestUser();
    const listing = await createTestListing(seller.id, { status: 'DRAFT' });

    const res = await testAgent().post(`/listings/${listing.id}/publish`).set('Authorization', `Bearer ${attacker.token}`);

    expect(res.status).toBe(403);
  });
});

describe('functional: editing and deleting listings', () => {
  it('allows the owner to edit their listing', async () => {
    const seller = await createTestUser();
    const listing = await createTestListing(seller.id);

    const res = await testAgent().patch(`/listings/${listing.id}`).set('Authorization', `Bearer ${seller.token}`).send({
      price: 999,
    });

    expect(res.status).toBe(200);
    expect(Number(res.body.price)).toBe(999);
  });

  it('does not allow a non-owner to edit a listing', async () => {
    const seller = await createTestUser();
    const attacker = await createTestUser();
    const listing = await createTestListing(seller.id);

    const res = await testAgent().patch(`/listings/${listing.id}`).set('Authorization', `Bearer ${attacker.token}`).send({
      price: 1,
    });

    expect(res.status).toBe(403);
  });

  it('does not allow setting status directly via PATCH (must go through /publish)', async () => {
    const seller = await createTestUser();
    const listing = await createTestListing(seller.id, { status: 'DRAFT' });

    const res = await testAgent().patch(`/listings/${listing.id}`).set('Authorization', `Bearer ${seller.token}`).send({
      status: 'ACTIVE',
    });

    expect(res.status).toBe(200);
    // Status should be unchanged - the field is silently ignored, not applied.
    expect(res.body.status).toBe('DRAFT');
  });

  it('allows the owner to remove their listing', async () => {
    const seller = await createTestUser();
    const listing = await createTestListing(seller.id);

    const res = await testAgent().delete(`/listings/${listing.id}`).set('Authorization', `Bearer ${seller.token}`);
    expect(res.status).toBe(204);

    const check = await testAgent().get(`/listings/${listing.id}`);
    // Removed listings are still fetchable by direct id (for order history
    // etc.) but should reflect the REMOVED status.
    expect(check.body.status).toBe('REMOVED');
  });
});
