'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/AuthContext';
import { apiRequest, ApiError } from '../../../lib/client';
import { deleteListing, pauseListing, resumeListing, daysUntilFreeHostingEnds, type Listing } from '../../../lib/listings';
import { startConversation } from '../../../lib/conversations';
import LikeButton from '../../../components/LikeButton';

export default function ListingDetailClient({ listing }: { listing: Listing & { bids: any[] } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [pausingOrResuming, setPausingOrResuming] = useState(false);
  const [ownerActionError, setOwnerActionError] = useState<string | null>(null);
  const [status, setStatus] = useState(listing.status);
  const [messaging, setMessaging] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const isOwner = user?.id === listing.sellerId;

  async function handleMessageSeller() {
    setMessaging(true);
    setMessageError(null);
    try {
      const conversation = await startConversation(listing.id);
      router.push(`/messages/${conversation.id}`);
    } catch (err) {
      setMessageError(err instanceof ApiError ? err.message : 'Could not start a conversation.');
      setMessaging(false);
    }
  }

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

  async function handleDelete() {
    const confirmed = window.confirm('Remove this listing? This cannot be undone.');
    if (!confirmed) return;

    setDeleting(true);
    setOwnerActionError(null);
    try {
      await deleteListing(listing.id);
      router.push('/');
    } catch (err) {
      setOwnerActionError(err instanceof ApiError ? err.message : 'Could not remove this listing.');
      setDeleting(false);
    }
  }

  async function handlePause() {
    setPausingOrResuming(true);
    setOwnerActionError(null);
    try {
      await pauseListing(listing.id);
      setStatus('PAUSED');
    } catch (err) {
      setOwnerActionError(err instanceof ApiError ? err.message : 'Could not pause this listing.');
    } finally {
      setPausingOrResuming(false);
    }
  }

  async function handleResume() {
    setPausingOrResuming(true);
    setOwnerActionError(null);
    try {
      await resumeListing(listing.id);
      setStatus('ACTIVE');
    } catch (err) {
      setOwnerActionError(err instanceof ApiError ? err.message : 'Could not resume this listing.');
    } finally {
      setPausingOrResuming(false);
    }
  }

  const daysLeft = daysUntilFreeHostingEnds(listing);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-neutral-100 rounded-lg h-80 flex items-center justify-center mb-3 overflow-hidden">
        {listing.images[activeImage] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[activeImage]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-neutral-400">No photo</span>
        )}
      </div>

      {listing.images.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {listing.images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${
                i === activeImage ? 'border-amber-600' : 'border-transparent'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {listing.images.length <= 1 && <div className="mb-6" />}

      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        <LikeButton
          listingId={listing.id}
          initialLiked={listing.likedByMe}
          initialCount={listing.likeCount}
          isOwner={isOwner}
        />
      </div>
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
        <div className="space-y-3">
          <div className="bg-amber-50 text-amber-800 rounded-md p-4 text-center">
            <p className="font-medium">This is your listing</p>
            {status === 'ACTIVE' && daysLeft != null && (
              <p className="text-sm mt-1">
                {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left of free hosting` : 'Hosting fee now applies (1%/month)'}
              </p>
            )}
            {status === 'PAUSED' && <p className="text-sm mt-1">Paused - hidden from buyers</p>}
          </div>

          {ownerActionError && <p className="text-red-600 text-sm text-center">{ownerActionError}</p>}

          {status === 'ACTIVE' && (
            <button
              onClick={handlePause}
              disabled={pausingOrResuming}
              className="w-full border border-amber-700 text-amber-700 rounded-md py-3 font-semibold hover:bg-amber-50 disabled:opacity-60"
            >
              {pausingOrResuming ? 'Pausing...' : 'Pause listing'}
            </button>
          )}
          {status === 'PAUSED' && (
            <button
              onClick={handleResume}
              disabled={pausingOrResuming}
              className="w-full border border-green-700 text-green-700 rounded-md py-3 font-semibold hover:bg-green-50 disabled:opacity-60"
            >
              {pausingOrResuming ? 'Resuming...' : 'Resume listing'}
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full border border-red-600 text-red-600 rounded-md py-3 font-semibold hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? 'Removing...' : 'Remove listing'}
          </button>
        </div>
      )}

      {!isOwner && !user && status === 'ACTIVE' && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-md p-4 text-center">
          <p className="text-neutral-700 mb-3">Log in to buy or place a bid on this item.</p>
          <button
            onClick={() => router.push(`/login?next=/listing/${listing.id}`)}
            className="bg-amber-700 text-white rounded-md px-6 py-3 font-semibold hover:bg-amber-800"
          >
            Log in
          </button>
        </div>
      )}

      {!isOwner && user && status === 'ACTIVE' && (
        <div className="space-y-6">
          <button
            onClick={() => router.push(`/checkout/new?listingId=${listing.id}&title=${encodeURIComponent(listing.title)}&price=${listing.price}`)}
            className="w-full bg-green-700 text-white rounded-md py-3 font-semibold hover:bg-green-800"
          >
            Buy Now — ${Number(listing.price).toFixed(2)}
          </button>

          <button
            onClick={handleMessageSeller}
            disabled={messaging}
            className="w-full border border-neutral-300 text-neutral-700 rounded-md py-3 font-semibold hover:bg-neutral-50 disabled:opacity-60"
          >
            {messaging ? 'Opening...' : 'Message seller'}
          </button>
          {messageError && <p className="text-red-600 text-sm">{messageError}</p>}

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
