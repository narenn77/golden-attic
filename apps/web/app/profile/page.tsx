'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';
import * as authApi from '../../lib/auth';
import { ApiError } from '../../lib/client';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setAddressLine1(user.addressLine1 || '');
      setAddressLine2(user.addressLine2 || '');
      setCity(user.city || '');
      setState(user.state || '');
      setPostalCode(user.postalCode || '');
    }
  }, [user]);

  async function handleResend() {
    setResendState('sending');
    try {
      const result = await authApi.resendVerification();
      setResendMessage(result.message);
      setResendState('sent');
    } catch (err) {
      setResendMessage(err instanceof ApiError ? err.message : 'Could not resend verification email.');
      setResendState('error');
    }
  }

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setSavingAddress(true);
    setAddressError(null);
    setAddressSaved(false);
    try {
      await authApi.updateAddress({ addressLine1, addressLine2, city, state, postalCode, country: 'US' });
      await refreshUser();
      setAddressSaved(true);
    } catch (err) {
      setAddressError(err instanceof ApiError ? err.message : 'Could not save your address.');
    } finally {
      setSavingAddress(false);
    }
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-neutral-500 mb-4">Please log in to view your profile.</p>
        <Link href="/login" className="text-amber-700 font-semibold hover:underline">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold">{user.name}</h1>
      <p className="text-neutral-500 mb-6">{user.email}</p>

      {!user.emailVerified && (
        <div className="bg-orange-50 text-orange-800 rounded-md p-4 mb-6 text-sm">
          <p className="mb-2">Please verify your email address.</p>
          {resendState === 'sent' ? (
            <p className="text-orange-700 font-medium">{resendMessage}</p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendState === 'sending'}
              className="underline font-semibold disabled:opacity-60"
            >
              {resendState === 'sending' ? 'Sending...' : 'Resend verification email'}
            </button>
          )}
          {resendState === 'error' && <p className="text-red-700 mt-1">{resendMessage}</p>}
        </div>
      )}

      <div className="border border-neutral-200 rounded-lg p-5 mb-6">
        <h2 className="font-semibold mb-1">Selling</h2>
        <p className="text-sm text-neutral-500 mb-4">
          {user.isSeller ? 'You can list items for sale.' : 'Set up payouts to start selling your items.'}
        </p>
        <Link
          href="/seller-onboarding"
          className="inline-block border border-amber-700 text-amber-700 rounded-md px-4 py-2 text-sm font-semibold hover:bg-amber-50"
        >
          {user.isSeller ? 'Manage payout settings' : 'Set up payouts'}
        </Link>
      </div>

      <div className="border border-neutral-200 rounded-lg p-5">
        <h2 className="font-semibold mb-1">Shipping address</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Used as your default ship-to address when buying, and your ship-from location when selling.
        </p>
        <form onSubmit={handleSaveAddress} className="space-y-2">
          <input
            placeholder="Address line 1"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Address line 2 (optional)"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-20 border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="ZIP"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="w-24 border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          {addressError && <p className="text-red-600 text-sm">{addressError}</p>}
          {addressSaved && <p className="text-green-700 text-sm">Address saved.</p>}
          <button
            type="submit"
            disabled={savingAddress}
            className="bg-amber-700 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-amber-800 disabled:opacity-60"
          >
            {savingAddress ? 'Saving...' : 'Save address'}
          </button>
        </form>
      </div>
    </div>
  );
}
