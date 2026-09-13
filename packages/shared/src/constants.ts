// Shared business-rule constants used by both backend and clients.

// TODO: commission rate not yet decided with the product owner — placeholder for now.
export const PLATFORM_COMMISSION_RATE = 0.05; // 5% of sale price

export const FREE_HOSTING_MONTHS = 1;
export const MONTHLY_HOSTING_FEE_RATE = 0.01; // 1% of listing price, per month, after free period

// Category taxonomy for listings, shared between the AI drafting prompt and
// any client-side category picker so they never drift apart.
export const LISTING_CATEGORIES = [
  'Stamps',
  'Coins',
  'Currency & Banknotes',
  'Trading Cards',
  'Vinyl Records & Music',
  'Vintage Toys',
  'Antiques & Furniture',
  'Art & Prints',
  'Books & Manuscripts',
  'Jewelry & Watches',
  'Militaria',
  'Sports Memorabilia',
  'Other Collectibles',
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
