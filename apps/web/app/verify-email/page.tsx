'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import * as authApi from '../../lib/auth';
import { ApiError } from '../../lib/client';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Could not verify your email.');
      });
  }, [searchParams]);

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      {status === 'loading' && <p className="text-neutral-500">Verifying your email...</p>}

      {status === 'success' && (
        <>
          <h1 className="text-2xl font-bold text-green-700 mb-3">Email verified!</h1>
          <p className="text-neutral-600 mb-8">{message}</p>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="text-2xl font-bold text-red-700 mb-3">Verification failed</h1>
          <p className="text-neutral-600 mb-8">{message}</p>
        </>
      )}

      <Link href="/" className="text-amber-700 font-semibold hover:underline">
        Continue to Golden Attic
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-24 text-center text-neutral-500">Loading...</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
