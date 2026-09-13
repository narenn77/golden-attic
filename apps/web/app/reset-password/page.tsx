'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as authApi from '../../lib/auth';
import { ApiError } from '../../lib/client';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('This reset link is missing its token.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24 text-center">
        <p className="text-red-600 mb-4">This reset link is missing its token.</p>
        <Link href="/forgot-password" className="text-amber-700 font-semibold hover:underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-green-700 mb-3">Password reset!</h1>
        <p className="text-neutral-600 mb-8">You can now log in with your new password.</p>
        <button
          onClick={() => router.push('/login')}
          className="bg-amber-700 text-white rounded-md px-6 py-3 font-semibold hover:bg-amber-800"
        >
          Go to login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-center text-amber-700 mb-8">Set a new password</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          placeholder="New password (min 8 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-4 py-3"
          required
        />

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-700 text-white rounded-md py-3 font-semibold hover:bg-amber-800 disabled:opacity-60"
        >
          {submitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="max-w-sm mx-auto px-4 py-24 text-center text-neutral-500">Loading...</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
