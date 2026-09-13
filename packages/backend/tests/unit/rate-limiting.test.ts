import { describe, it, expect } from 'vitest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import supertest from 'supertest';

// The real auth/AI-draft rate limiters are disabled in the test environment
// (see auth.ts / aiListing.ts) so the rest of the suite can run quickly.
// This test exercises express-rate-limit's actual behavior in isolation,
// using the same configuration shape, so the limiting logic itself still
// has coverage.
describe('unit: rate limiting behavior', () => {
  it('blocks requests once the limit is exceeded, within the same window', async () => {
    const app = express();
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      limit: 3,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { message: 'Too many requests' } },
    });
    app.get('/test', limiter, (_req, res) => res.json({ ok: true }));

    const agent = supertest(app);

    const r1 = await agent.get('/test');
    const r2 = await agent.get('/test');
    const r3 = await agent.get('/test');
    const r4 = await agent.get('/test');

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    expect(r4.status).toBe(429);
    expect(r4.body.error.message).toBe('Too many requests');
  });
});
