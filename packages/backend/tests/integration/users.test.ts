import { describe, it, expect } from 'vitest';
import { testAgent } from '../helpers/agent.js';
import { createTestUser } from '../helpers/factories.js';

describe('regression: user profile data exposure', () => {
  it('SECURITY REGRESSION: GET /users/:id no longer exposes email or phone', async () => {
    const user = await createTestUser();

    const res = await testAgent().get(`/users/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(user.name);
    expect(res.body.email).toBeUndefined();
    expect(res.body.phone).toBeUndefined();
  });

  it('still returns public-safe fields with no auth required (seller display name is needed publicly)', async () => {
    const user = await createTestUser();

    const res = await testAgent().get(`/users/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.isSeller).toBeDefined();
  });

  it('returns 404 for a nonexistent user', async () => {
    const res = await testAgent().get('/users/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('functional: become-seller', () => {
  it('flips isSeller to true for the authenticated user', async () => {
    const user = await createTestUser({ isSeller: false });

    const res = await testAgent().patch(`/users/${user.id}/become-seller`).set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.isSeller).toBe(true);
  });

  it('SECURITY REGRESSION: does not return the password hash or token hashes in the response', async () => {
    const user = await createTestUser();

    const res = await testAgent().patch(`/users/${user.id}/become-seller`).set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.emailVerificationToken).toBeUndefined();
    expect(res.body.passwordResetToken).toBeUndefined();
    expect(res.body.stripeConnectAccountId).toBeUndefined();
  });

  it('does not allow a user to flip another user\'s isSeller flag', async () => {
    const user = await createTestUser();
    const attacker = await createTestUser();

    const res = await testAgent().patch(`/users/${user.id}/become-seller`).set('Authorization', `Bearer ${attacker.token}`);

    expect(res.status).toBe(403);
  });

  it('requires auth', async () => {
    const user = await createTestUser();
    const res = await testAgent().patch(`/users/${user.id}/become-seller`);
    expect(res.status).toBe(401);
  });
});
