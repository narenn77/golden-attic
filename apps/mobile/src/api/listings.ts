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
  weightOz: number | null;
  createdAt: string;
  freeUntil: string | null;
  hostingPaidUntil: string | null;
  pausedAt: string | null;
  likeCount: number;
  likedByMe: boolean;
  pendingBidCount?: number; // only present when viewing your own listings
  seller?: { id: string; name: string };
}

export interface ListingQueryParams {
  category?: string;
  country?: string;
  sellerId?: string;
  status?: string;
  sort?: string;
}

export function fetchListings(params?: ListingQueryParams) {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.country) query.set('country', params.country);
  if (params?.sellerId) query.set('sellerId', params.sellerId);
  if (params?.status) query.set('status', params.status);
  if (params?.sort) query.set('sort', params.sort);
  const qs = query.toString();
  // Auth is attached when a token exists (needed for likedByMe and own-
  // listings status=ALL); anonymous browsing still works with no token.
  return apiRequest<Listing[]>(`/listings${qs ? `?${qs}` : ''}`);
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
  weightOz?: number | null;
}) {
  return apiRequest<Listing>('/listings', { method: 'POST', body: input });
}

export function publishListing(id: string) {
  return apiRequest<Listing>(`/listings/${id}/publish`, { method: 'POST' });
}

export function deleteListing(id: string) {
  return apiRequest<void>(`/listings/${id}`, { method: 'DELETE' });
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
 * not applicable. Negative means hosting fees now apply. */
export function daysUntilFreeHostingEnds(listing: Pick<Listing, 'freeUntil'>): number | null {
  if (!listing.freeUntil) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((new Date(listing.freeUntil).getTime() - Date.now()) / msPerDay);
}
