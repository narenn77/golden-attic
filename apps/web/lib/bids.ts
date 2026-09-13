import { apiRequest } from './client';

export interface Bid {
  id: string;
  listingId: string;
  bidderId: string;
  amount: string;
  counterAmount: string | null;
  status: 'PENDING' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  createdAt: string;
  listing?: { id: string; title: string; images: string[]; price: string; status: string };
  bidder?: { id: string; name: string };
}

export interface BidNotifications {
  pendingOnMyListings: number;
  counteredOnMyBids: number;
}

export function fetchMyBids() {
  return apiRequest<Bid[]>('/bids');
}

export function fetchBidNotifications() {
  return apiRequest<BidNotifications>('/bids/meta/notifications');
}

export function counterBid(bidId: string, counterAmount: number) {
  return apiRequest<Bid>(`/bids/${bidId}/counter`, { method: 'POST', body: { counterAmount } });
}

export function acceptBid(bidId: string) {
  return apiRequest<Bid>(`/bids/${bidId}/accept`, { method: 'POST' });
}

export function rejectBid(bidId: string) {
  return apiRequest<Bid>(`/bids/${bidId}/reject`, { method: 'POST' });
}
