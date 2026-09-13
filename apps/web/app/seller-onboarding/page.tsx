'use client';

import { useCallback, useEffect, useState } from 'react';
import { startSellerOnboarding, getSellerOnboardingStatus } from '../../lib/payments';
import { becomeSeller } from '../../lib/auth';
import { useAuth } from '../../lib/AuthContext';

export default function SellerOnboardingPage() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<{ onboarded: boolean; chargesEnabled: boolean; payoutsEnabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const result = await getSellerOnboardingStatus();
      setStatus(result);
      if (result.chargesEnabled && result.payoutsEnabled && user && !user.isSeller) {
        await becomeSeller(user.id);
        await refreshUser();
      }
    } catch {
      setStatus({ onboarded: false, chargesEnabled: false, payoutsEnabled: false });
    } finally {
      setLoading(false);
    }
  }, [user, refreshUser]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Re-check status when the tab regains focus - this is how we notice the
  // seller finished Stripe's hosted onboarding flow in the other tab.
  useEffect(() => {
    function onFocus() {
      loadStatus();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadStatus]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { url } = await startSellerOnboarding();
      window.open(url, '_blank');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  if (loading) {
    return <div className="max-w-md mx-auto px-4 py-16 text-center text-neutral-500">Loading...</div>;
  }

  const fullyOnboarded = status?.chargesEnabled && status?.payoutsEnabled;

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-3">Get paid for your sales</h1>
      <p className="text-neutral-600 mb-8 leading-relaxed">
        Golden Attic uses Stripe to securely send you money when your items sell. It takes about 5 minutes to set up
        and only needs to be done once.
      </p>

      {fullyOnboarded ? (
        <div className="bg-green-50 text-green-800 rounded-lg p-4 text-center font-medium">
          ✓ You&apos;re all set up to receive payouts.
        </div>
      ) : (
        <>
          {status?.onboarded && !fullyOnboarded && (
            <div className="bg-orange-50 text-orange-800 rounded-lg p-4 mb-4 text-sm">
              You&apos;ve started setup but there are still a few details Stripe needs. Click below to finish.
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full bg-[#635BFF] text-white rounded-md py-3 font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {connecting ? 'Opening Stripe...' : status?.onboarded ? 'Finish setup with Stripe' : 'Set up payouts with Stripe'}
          </button>
        </>
      )}
    </div>
  );
}
