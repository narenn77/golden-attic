import { apiRequest } from './client';

export interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  commissionAmount: string;
  sellerPayoutAmount: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
}

export function createOrder(input: { listingId: string; amount: number }) {
  return apiRequest<Order>('/orders', { method: 'POST', body: input });
}

export function fetchOrder(id: string) {
  return apiRequest<Order>(`/orders/${id}`);
}
