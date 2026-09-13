import { apiRequest } from './client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isSeller: boolean;
  emailVerified: boolean;
}

export interface UserAddress {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function signup(input: { email: string; password: string; name: string; phone?: string }) {
  return apiRequest<AuthResponse>('/auth/signup', { method: 'POST', body: input, auth: false });
}

export function login(input: { email: string; password: string }) {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false });
}

export function getMe() {
  return apiRequest<AuthUser & { phone: string | null; createdAt: string } & UserAddress>('/auth/me');
}

export function updateAddress(address: Partial<UserAddress>) {
  return apiRequest<AuthUser & UserAddress>('/users/me/address', { method: 'PATCH', body: address });
}

export function forgotPassword(email: string) {
  return apiRequest<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
}

export function resetPassword(token: string, newPassword: string) {
  return apiRequest<{ message: string }>('/auth/reset-password', { method: 'POST', body: { token, newPassword }, auth: false });
}

export function resendVerification() {
  return apiRequest<{ message: string }>('/auth/resend-verification', { method: 'POST' });
}

export function becomeSeller(userId: string) {
  return apiRequest<AuthUser>(`/users/${userId}/become-seller`, { method: 'PATCH' });
}
