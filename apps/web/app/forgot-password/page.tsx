'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as authApi from '../../lib/auth';
import { ApiError } from '../../lib/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await authApi.forgotPassword(email.trim());
      setMessage(result.message);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-center text-amber-700 mb-2">Reset your password</h1>
      <p className="text-center text-neutral-500 mb-8">Enter your email and we&apos;ll send a reset link.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-4 py-3"
          required
        />

        {message && <p className="text-sm text-center text-neutral-700">{message}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-700 text-white rounded-md py-3 font-semibold hover:bg-amber-800 disabled:opacity-60"
        >
          {submitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <div className="text-center mt-6">
        <Link href="/login" className="text-sm text-amber-700 hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
