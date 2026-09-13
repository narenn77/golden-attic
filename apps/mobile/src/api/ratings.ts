import { apiRequest } from './client';

export interface Rating {
  id: string;
  orderId: string;
  raterId: string;
  ratedUserId: string;
  score: number;
  comment: string | null;
  createdAt: string;
  rater: { id: string; name: string };
}

export interface RatingsSummary {
  average: number | null;
  count: number;
  ratings: Rating[];
}

export interface RatingEligibility {
  eligible: boolean;
  alreadyRated: boolean;
  orderStatus: string;
}

export function fetchUserRatings(userId: string) {
  return apiRequest<RatingsSummary>(`/users/${userId}/ratings`, { auth: false });
}

export function fetchRatingEligibility(orderId: string) {
  return apiRequest<RatingEligibility>(`/orders/${orderId}/rating-eligibility`);
}

export function rateOrder(orderId: string, score: number, comment?: string) {
  return apiRequest<Rating>(`/orders/${orderId}/rate`, { method: 'POST', body: { score, comment } });
}
