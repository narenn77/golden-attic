'use client';

import Link from 'next/link';
import type { Listing } from '../lib/listings';
import LikeButton from './LikeButton';
import { useAuth } from '../lib/AuthContext';

export default function ListingCard({ listing }: { listing: Listing }) {
  const { user } = useAuth();

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="block bg-white border border-neutral-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="h-40 bg-neutral-100 flex items-center justify-center">
        {listing.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-neutral-400 text-sm">No photo</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{listing.title}</h3>
        <p className="text-xs text-neutral-500 mb-1">
          {listing.category}
          {(listing.year || listing.country) && (
            <span>
              {' · '}
              {[listing.year, listing.country].filter(Boolean).join(', ')}
            </span>
          )}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-amber-700 font-bold">${Number(listing.price).toFixed(2)}</p>
          <LikeButton
            listingId={listing.id}
            initialLiked={listing.likedByMe}
            initialCount={listing.likeCount}
            isOwner={user?.id === listing.sellerId}
            size="sm"
          />
        </div>
      </div>
    </Link>
  );
}
