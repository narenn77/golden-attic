'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';
import * as authApi from '../../lib/auth';
import { ApiError } from '../../lib/client';

export default function ProfilePage() {
  const { user } = useAuth();
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

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

      <div className="border border-neutral-200 rounded-lg p-5">
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
    </div>
  );
}
