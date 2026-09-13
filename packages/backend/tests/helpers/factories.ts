import { prisma } from '../../src/lib/prisma.js';
import { hashPassword, signToken } from '../../src/lib/auth.js';

let userCounter = 0;

export const TEST_PASSWORD = 'correct-horse-battery-staple';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  token: string;
}

export async function createTestUser(overrides: Partial<{ name: string; email: string; isSeller: boolean; emailVerified: boolean; stripeConnectAccountId: string }> = {}): Promise<TestUser> {
  userCounter += 1;
  const email = overrides.email ?? `test-user-${userCounter}-${Date.now()}@example.com`;
  const name = overrides.name ?? `Test User ${userCounter}`;
  const passwordHash = await hashPassword(TEST_PASSWORD);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      isSeller: overrides.isSeller ?? false,
      emailVerified: overrides.emailVerified ?? true,
      stripeConnectAccountId: overrides.stripeConnectAccountId,
    },
  });

  const token = signToken({ userId: user.id, email: user.email });

  return { id: user.id, email: user.email, name: user.name, token };
}

/** A user who has already completed Stripe Connect onboarding - convenient
 * for order/checkout tests that need a payable seller without going through
 * the onboarding flow themselves. */
export async function createOnboardedSeller(overrides: Partial<{ name: string; email: string }> = {}) {
  return createTestUser({ ...overrides, isSeller: true, stripeConnectAccountId: `acct_test_seed_${Date.now()}_${Math.random().toString(36).slice(2)}` });
}

let listingCounter = 0;

export async function createTestListing(sellerId: string, overrides: Partial<{
  title: string;
  description: string;
  category: string;
  price: number;
  status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'REMOVED';
  allowBidding: boolean;
}> = {}) {
  listingCounter += 1;
  const listing = await prisma.listing.create({
    data: {
      sellerId,
      title: overrides.title ?? `Test Listing ${listingCounter}`,
      description: overrides.description ?? 'A test item for automated testing.',
      category: overrides.category ?? 'Other Collectibles',
      price: overrides.price ?? 100,
      status: overrides.status ?? 'ACTIVE',
      allowBidding: overrides.allowBidding ?? true,
      publishedAt: overrides.status !== 'DRAFT' ? new Date() : null,
    },
  });
  return listing;
}

export async function createTestBid(listingId: string, bidderId: string, overrides: Partial<{ amount: number; status: string; counterAmount: number }> = {}) {
  return prisma.bid.create({
    data: {
      listingId,
      bidderId,
      amount: overrides.amount ?? 80,
      status: (overrides.status as any) ?? 'PENDING',
      counterAmount: overrides.counterAmount,
    },
  });
}
