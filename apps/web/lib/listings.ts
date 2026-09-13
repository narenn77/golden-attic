import { apiRequest } from './client';

export interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  category: string;
  price: string; // Prisma Decimal serializes as a string over JSON
  images: string[];
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'SOLD' | 'EXPIRED' | 'REMOVED';
  allowBidding: boolean;
  aiGenerated: boolean;
  year: number | null;
  country: string | null;
  createdAt: string;
  freeUntil: string | null;
  hostingPaidUntil: string | null;
  pausedAt: string | null;
  likeCount: number;
  likedByMe: boolean;
  seller?: { id: string; name: string };
}

export type ListingSort = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'year_newest' | 'year_oldest' | 'most_liked';

export interface ListingFilters {
  category?: string; // comma-separated for multi-select, e.g. "Stamps,Coins"
  country?: string; // comma-separated for multi-select
  decade?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: ListingSort;
  sellerId?: string;
  status?: string; // only honored by the backend when sellerId is the caller's own id
}

export interface ListingFilterOptions {
  categories: readonly string[];
  countries: string[];
  minYear: number | null;
  maxYear: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export function fetchListings(params?: ListingFilters) {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.country) query.set('country', params.country);
  if (params?.decade != null) query.set('decade', String(params.decade));
  if (params?.minPrice != null) query.set('minPrice', String(params.minPrice));
  if (params?.maxPrice != null) query.set('maxPrice', String(params.maxPrice));
  if (params?.sort) query.set('sort', params.sort);
  if (params?.sellerId) query.set('sellerId', params.sellerId);
  if (params?.status) query.set('status', params.status);

  const qs = query.toString();
  // Auth is attached (when a token exists) so that filtering by the caller's
  // own sellerId+status=ALL and per-listing likedByMe both work correctly -
  // anonymous browsing still works fine since the backend treats a missing
  // user as "not the owner" and just returns public ACTIVE listings.
  return apiRequest<Listing[]>(`/listings${qs ? `?${qs}` : ''}`);
}

export function fetchListingFilterOptions() {
  return apiRequest<ListingFilterOptions>('/listings/filters', { auth: false });
}

export function fetchListing(id: string) {
  return apiRequest<Listing & { bids: any[] }>(`/listings/${id}`);
}

export function createListing(input: {
  title: string;
  description: string;
  category: string;
  price: number;
  images: string[];
  aiGenerated?: boolean;
  allowBidding?: boolean;
  year?: number | null;
  country?: string | null;
}) {
  return apiRequest<Listing>('/listings', { method: 'POST', body: input });
}

export function deleteListing(id: string) {
  return apiRequest<void>(`/listings/${id}`, { method: 'DELETE' });
}

export function publishListing(id: string) {
  return apiRequest<Listing>(`/listings/${id}/publish`, { method: 'POST' });
}

export function pauseListing(id: string) {
  return apiRequest<Listing>(`/listings/${id}/pause`, { method: 'POST' });
}

export function resumeListing(id: string) {
  return apiRequest<Listing>(`/listings/${id}/resume`, { method: 'POST' });
}

export function likeListing(id: string) {
  return apiRequest<{ liked: boolean; likeCount: number }>(`/listings/${id}/like`, { method: 'POST' });
}

export function unlikeListing(id: string) {
  return apiRequest<{ liked: boolean; likeCount: number }>(`/listings/${id}/like`, { method: 'DELETE' });
}

export function fetchLikedListings() {
  return apiRequest<Listing[]>('/listings/liked/mine');
}

export interface AiListingDraft {
  title: string;
  description: string;
  category: string;
  suggestedPriceUsd: number;
  confidence: 'low' | 'medium' | 'high';
  year: number | null;
  country: string | null;
}

export function requestAiDraft(input: { images: string[]; note?: string }) {
  return apiRequest<{ draft: AiListingDraft }>('/listings/ai-draft', { method: 'POST', body: input });
}

/** Days remaining until a listing's free hosting period ends, or null if
 * there's no free-hosting deadline (e.g. it's still a draft) or it's
 * already sold/removed. Negative means the free period has already lapsed
 * and hosting fees now apply. */
export function daysUntilFreeHostingEnds(listing: Pick<Listing, 'freeUntil'>): number | null {
  if (!listing.freeUntil) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((new Date(listing.freeUntil).getTime() - Date.now()) / msPerDay);
}
