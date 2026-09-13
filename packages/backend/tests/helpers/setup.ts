import { config } from 'dotenv';
import { resolve } from 'path';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Load test-specific environment variables before anything else (DATABASE_URL
// pointing at the dedicated test database, a test JWT secret, etc).
config({ path: resolve(__dirname, '../../.env.test') });

// Replace the three external-service clients with deterministic in-memory
// mocks for the whole test run - no real Stripe/Resend/Anthropic calls, no
// cost, no network flakiness, no need for real API keys in CI.
vi.mock('../../src/lib/stripe.js', () => import('./mocks/stripe.js'));
vi.mock('../../src/lib/email.js', () => import('./mocks/email.js'));
vi.mock('../../src/lib/anthropic.js', () => import('./mocks/anthropic.js'));

import { prisma } from '../../src/lib/prisma.js';
import { resetSentEmails } from './mocks/email.js';
import { resetStripeMockState } from './mocks/stripe.js';
import { resetAnthropicMockState } from './mocks/anthropic.js';

// Truncate every table before each test file starts, and once more at the
// very end, so tests never see leftover data from a previous run and never
// leave data behind for the next one.
async function resetDatabase() {
  await prisma.hostingFee.deleteMany();
  await prisma.order.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  resetSentEmails();
  resetStripeMockState();
  resetAnthropicMockState();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});
