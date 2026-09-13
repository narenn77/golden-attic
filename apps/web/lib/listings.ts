import { apiRequest } from './client';

export interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  category: string;
  price: string; // Prisma Decimal serializes as a string over JSON
  images: string[];
  status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'REMOVED';
  allowBidding: boolean;
  aiGenerated: boolean;
  year: number | null;
  country: string | null;
  createdAt: string;
  seller?: { id: string; name: string };
}

export type ListingSort = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'year_newest' | 'year_oldest';

export interface ListingFilters {
  category?: string;
  country?: string;
  decade?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: ListingSort;
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

  const qs = query.toString();
  return apiRequest<Listing[]>(`/listings${qs ? `?${qs}` : ''}`, { auth: false });
}

export function fetchListingFilterOptions() {
  return apiRequest<ListingFilterOptions>('/listings/filters', { auth: false });
}

export function fetchListing(id: string) {
  return apiRequest<Listing & { bids: any[] }>(`/listings/${id}`, { auth: false });
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
