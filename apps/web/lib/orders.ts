import { apiRequest } from './client';

export interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  commissionAmount: string;
  sellerPayoutAmount: string;
  localPickup: boolean;
  shippingCost: string | null;
  shippingCity: string | null;
  status: 'PENDING_PAYMENT' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
  listing?: { id: string; title: string; images: string[] };
  buyer?: { id: string; name: string };
  seller?: { id: string; name: string };
}

export interface ShippingQuote {
  shippingCost: number;
  service: string;
  estimated: boolean;
  localPickupEligible: boolean;
  sellerCity: string | null;
  sellerState: string | null;
}

export function fetchShippingQuote(listingId: string) {
  return apiRequest<ShippingQuote>(`/listings/${listingId}/shipping-quote`);
}

export function createOrder(input: { listingId: string; localPickup?: boolean }) {
  return apiRequest<Order>('/orders', { method: 'POST', body: input });
}

export function fetchOrder(id: string) {
  return apiRequest<Order>(`/orders/${id}`);
}

export function fetchMyOrders(role?: 'buyer' | 'seller') {
  const qs = role ? `?role=${role}` : '';
  return apiRequest<Order[]>(`/orders${qs}`);
}

export function completeOrder(id: string) {
  return apiRequest<Order>(`/orders/${id}/complete`, { method: 'POST' });
}
