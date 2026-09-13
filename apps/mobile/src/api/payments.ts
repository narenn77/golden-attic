import { apiRequest } from './client';

export function createCheckoutIntent(orderId: string) {
  return apiRequest<{ clientSecret: string }>('/payments/checkout', { method: 'POST', body: { orderId } });
}

export function startSellerOnboarding() {
  return apiRequest<{ url: string }>('/payments/connect/onboard', { method: 'POST' });
}

export function getSellerOnboardingStatus() {
  return apiRequest<{ onboarded: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted?: boolean }>(
    '/payments/connect/status'
  );
}
