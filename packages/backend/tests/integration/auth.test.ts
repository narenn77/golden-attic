import { describe, it, expect, beforeEach } from 'vitest';
import { testAgent } from '../helpers/agent.js';
import { createTestUser, TEST_PASSWORD } from '../helpers/factories.js';
import { extractTokenFromLastEmail, sentEmails } from '../helpers/mocks/email.js';
import { prisma } from '../../src/lib/prisma.js';

describe('functional: auth signup', () => {
  it('creates a new account and returns a usable token', async () => {
    const res = await testAgent().post('/auth/signup').send({
      email: 'newuser@example.com',
      password: 'a-decent-password',
      name: 'New User',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('newuser@example.com');
    expect(res.body.user.emailVerified).toBe(false);
    // Never leak the password hash back to the client
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('sends a verification email on signup', async () => {
    await testAgent().post('/auth/signup').send({
      email: 'verifyme@example.com',
      password: 'a-decent-password',
      name: 'Verify Me',
    });

    const email = sentEmails.find((e) => e.to === 'verifyme@example.com');
    expect(email).toBeTruthy();
    expect(email!.subject).toMatch(/verify/i);
  });

  it('rejects a duplicate email', async () => {
    await createTestUser({ email: 'dupe@example.com' });

    const res = await testAgent().post('/auth/signup').send({
      email: 'dupe@example.com',
      password: 'a-decent-password',
      name: 'Someone Else',
    });

    expect(res.status).toBe(409);
  });

  it('rejects a password under 8 characters', async () => {
    const res = await testAgent().post('/auth/signup').send({
      email: 'shortpw@example.com',
      password: 'short',
      name: 'Short PW',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid email format', async () => {
    const res = await testAgent().post('/auth/signup').send({
      email: 'not-an-email',
      password: 'a-decent-password',
      name: 'Bad Email',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a signup missing required fields', async () => {
    const res = await testAgent().post('/auth/signup').send({ email: 'incomplete@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('functional: auth login', () => {
  it('logs in with correct credentials', async () => {
    const user = await createTestUser({ email: 'logintest@example.com' });

    const res = await testAgent().post('/auth/login').send({
      email: user.email,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rejects an incorrect password', async () => {
    const user = await createTestUser({ email: 'wrongpw@example.com' });

    const res = await testAgent().post('/auth/login').send({
      email: user.email,
      password: 'totally-wrong-password',
    });

    expect(res.status).toBe(401);
  });

  it('rejects a login for a non-existent email', async () => {
    const res = await testAgent().post('/auth/login').send({
      email: 'doesnotexist@example.com',
      password: 'whatever-password',
    });
    expect(res.status).toBe(401);
  });

  it('gives the same error message for wrong password and unknown email (no account enumeration)', async () => {
    const user = await createTestUser({ email: 'enum-check@example.com' });

    const wrongPw = await testAgent().post('/auth/login').send({ email: user.email, password: 'nope' });
    const noAccount = await testAgent().post('/auth/login').send({ email: 'nobody@example.com', password: 'nope' });

    expect(wrongPw.body.error.message).toBe(noAccount.body.error.message);
  });
});

describe('functional: GET /auth/me', () => {
  it('returns the current user when authenticated', async () => {
    const user = await createTestUser({ email: 'me@example.com' });

    const res = await testAgent().get('/auth/me').set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('rejects a request with no token', async () => {
    const res = await testAgent().get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const res = await testAgent().get('/auth/me').set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });
});

describe('functional: email verification', () => {
  it('verifies an email with a valid token from the signup email', async () => {
    await testAgent().post('/auth/signup').send({
      email: 'toverify@example.com',
      password: 'a-decent-password',
      name: 'To Verify',
    });

    const token = extractTokenFromLastEmail('toverify@example.com');
    const res = await testAgent().post('/auth/verify-email').send({ token });

    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: 'toverify@example.com' } });
    expect(user?.emailVerified).toBe(true);
  });

  it('rejects an invalid verification token', async () => {
    const res = await testAgent().post('/auth/verify-email').send({ token: 'not-a-real-token' });
    expect(res.status).toBe(400);
  });

  it('rejects reusing an already-consumed verification token', async () => {
    await testAgent().post('/auth/signup').send({
      email: 'reuse@example.com',
      password: 'a-decent-password',
      name: 'Reuse Test',
    });
    const token = extractTokenFromLastEmail('reuse@example.com');

    const first = await testAgent().post('/auth/verify-email').send({ token });
    expect(first.status).toBe(200);

    const second = await testAgent().post('/auth/verify-email').send({ token });
    expect(second.status).toBe(400);
  });
});

describe('functional: password reset', () => {
  it('resets a password with a valid token and allows login with the new password', async () => {
    const user = await createTestUser({ email: 'resetme@example.com' });

    const forgotRes = await testAgent().post('/auth/forgot-password').send({ email: user.email });
    expect(forgotRes.status).toBe(200);

    const token = extractTokenFromLastEmail(user.email);
    const resetRes = await testAgent().post('/auth/reset-password').send({ token, newPassword: 'brand-new-password' });
    expect(resetRes.status).toBe(200);

    const loginOld = await testAgent().post('/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    expect(loginOld.status).toBe(401);

    const loginNew = await testAgent().post('/auth/login').send({ email: user.email, password: 'brand-new-password' });
    expect(loginNew.status).toBe(200);
  });

  it('does not reveal whether an email is registered', async () => {
    const known = await createTestUser({ email: 'known@example.com' });
    const knownRes = await testAgent().post('/auth/forgot-password').send({ email: known.email });
    const unknownRes = await testAgent().post('/auth/forgot-password').send({ email: 'unknown@example.com' });

    expect(knownRes.status).toBe(200);
    expect(unknownRes.status).toBe(200);
    expect(knownRes.body.message).toBe(unknownRes.body.message);
  });

  it('rejects an invalid reset token', async () => {
    const res = await testAgent().post('/auth/reset-password').send({ token: 'bogus', newPassword: 'brand-new-password' });
    expect(res.status).toBe(400);
  });
});
