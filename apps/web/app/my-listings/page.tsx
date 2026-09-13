'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchListings, pauseListing, resumeListing, deleteListing,
  daysUntilFreeHostingEnds, type Listing,
} from '../../lib/listings';
import { ApiError } from '../../lib/client';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  SOLD: 'Sold',
  EXPIRED: 'Expired',
  REMOVED: 'Removed',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-neutral-100 text-neutral-600',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  SOLD: 'bg-blue-100 text-blue-700',
  EXPIRED: 'bg-neutral-100 text-neutral-500',
  REMOVED: 'bg-red-100 text-red-700',
};

function FreeHostingBadge({ listing }: { listing: Listing }) {
  const daysLeft = daysUntilFreeHostingEnds(listing);
  if (daysLeft == null) return null;

  if (daysLeft > 0) {
    return (
      <span className="text-xs text-neutral-500">
        {daysLeft} day{daysLeft === 1 ? '' : 's'} left of free hosting
      </span>
    );
  }
  return <span className="text-xs text-amber-700">Hosting fee now applies (1%/month)</span>;
}

export default function MyListingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchListings({ sellerId: user.id, status: 'ALL' });
      // Newest first, but REMOVED listings sink to the bottom - no one wants
      // to scroll past their deleted items to find active ones.
      const sorted = [...data].sort((a, b) => {
        if ((a.status === 'REMOVED') !== (b.status === 'REMOVED')) {
          return a.status === 'REMOVED' ? 1 : -1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setListings(sorted);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your listings.');
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePause(id: string) {
    setBusyId(id);
    try {
      await pauseListing(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not pause this listing.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleResume(id: string) {
    setBusyId(id);
    try {
      await resumeListing(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resume this listing.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this listing? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await deleteListing(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this listing.');
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-neutral-500 mb-4">Please log in to see your listings.</p>
        <Link href="/login" className="text-amber-700 font-semibold hover:underline">Log in</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Listings</h1>
        <Link href="/sell" className="bg-amber-700 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-amber-800">
          + New listing
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {listings === null && <p className="text-neutral-500">Loading...</p>}
      {listings?.length === 0 && <p className="text-neutral-500">You haven&apos;t listed anything yet.</p>}

      <div className="space-y-3">
        {listings?.map((listing) => (
          <div key={listing.id} className="border border-neutral-200 rounded-lg p-4 flex gap-4">
            <Link href={`/listing/${listing.id}`} className="shrink-0">
              <div className="w-20 h-20 bg-neutral-100 rounded-md overflow-hidden flex items-center justify-center">
                {listing.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-neutral-400 text-xs">No photo</span>
                )}
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link href={`/listing/${listing.id}`} className="font-medium truncate hover:underline">
                  {listing.title}
                </Link>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[listing.status]}`}>
                  {STATUS_LABELS[listing.status]}
                </span>
              </div>
              <p className="text-sm text-neutral-500 mb-1">${Number(listing.price).toFixed(2)}</p>
              {listing.status === 'ACTIVE' && <FreeHostingBadge listing={listing} />}

              <div className="flex gap-3 mt-2">
                {listing.status === 'ACTIVE' && (
                  <button
                    onClick={() => handlePause(listing.id)}
                    disabled={busyId === listing.id}
                    className="text-sm text-amber-700 underline disabled:opacity-60"
                  >
                    Pause
                  </button>
                )}
                {listing.status === 'PAUSED' && (
                  <button
                    onClick={() => handleResume(listing.id)}
                    disabled={busyId === listing.id}
                    className="text-sm text-green-700 underline disabled:opacity-60"
                  >
                    Resume
                  </button>
                )}
                {listing.status !== 'REMOVED' && (
                  <button
                    onClick={() => handleDelete(listing.id)}
                    disabled={busyId === listing.id}
                    className="text-sm text-red-600 underline disabled:opacity-60"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
