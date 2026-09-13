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

export function fetchListings(params?: { category?: string }) {
  const query = params?.category ? `?category=${encodeURIComponent(params.category)}` : '';
  return apiRequest<Listing[]>(`/listings${query}`, { auth: false });
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
