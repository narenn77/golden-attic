'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/AuthContext';
import { apiRequest, ApiError } from '../../../lib/client';
import type { Listing } from '../../../lib/listings';

export default function ListingDetailClient({ listing }: { listing: Listing & { bids: any[] } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState(false);

  const isOwner = user?.id === listing.sellerId;

  async function placeBid(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) {
      setBidError('Enter a valid bid amount.');
      return;
    }
    setSubmittingBid(true);
    setBidError(null);
    try {
      await apiRequest('/bids', { method: 'POST', body: { listingId: listing.id, amount } });
      setBidSuccess(true);
      setBidAmount('');
    } catch (err) {
      setBidError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmittingBid(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-neutral-100 rounded-lg h-80 flex items-center justify-center mb-6 overflow-hidden">
        {listing.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-neutral-400">No photo</span>
        )}
      </div>

      <h1 className="text-2xl font-bold mb-1">{listing.title}</h1>
      <p className="text-neutral-500 mb-3">
        {listing.category}
        {(listing.year || listing.country) && (
          <span> · {[listing.year, listing.country].filter(Boolean).join(', ')}</span>
        )}
      </p>
      <p className="text-3xl font-bold text-amber-700 mb-4">${Number(listing.price).toFixed(2)}</p>
      <p className="text-neutral-700 leading-relaxed mb-6">{listing.description}</p>

      {listing.seller && <p className="text-sm text-neutral-500 mb-6">Sold by {listing.seller.name}</p>}

      {isOwner && (
        <div className="bg-amber-50 text-amber-800 rounded-md p-4 text-center font-medium">This is your listing</div>
      )}

      {!isOwner && listing.status === 'ACTIVE' && (
        <div className="space-y-6">
          <button
            onClick={() => router.push(`/checkout/new?listingId=${listing.id}&title=${encodeURIComponent(listing.title)}&price=${listing.price}`)}
            className="w-full bg-green-700 text-white rounded-md py-3 font-semibold hover:bg-green-800"
          >
            Buy Now — ${Number(listing.price).toFixed(2)}
          </button>

          {listing.allowBidding && (
            <div className="border-t border-neutral-200 pt-6">
              <h2 className="font-semibold mb-3">Place a bid</h2>
              {bidSuccess ? (
                <p className="text-green-700">Your bid has been sent to the seller.</p>
              ) : (
                <form onSubmit={placeBid} className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount ($)"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="flex-1 border border-neutral-300 rounded-md px-4 py-3"
                  />
                  <button
                    type="submit"
                    disabled={submittingBid}
                    className="bg-amber-700 text-white rounded-md px-6 font-semibold hover:bg-amber-800 disabled:opacity-60"
                  >
                    {submittingBid ? '...' : 'Bid'}
                  </button>
                </form>
              )}
              {bidError && <p className="text-red-600 text-sm mt-2">{bidError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
