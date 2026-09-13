'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { likeListing, unlikeListing } from '../lib/listings';

export default function LikeButton({
  listingId,
  initialLiked,
  initialCount,
  isOwner,
  size = 'md',
}: {
  listingId: string;
  initialLiked: boolean;
  initialCount: number;
  isOwner: boolean;
  size?: 'sm' | 'md';
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  // Sellers can't like their own listings - just show the count, no button.
  if (isOwner) {
    return (
      <span className="inline-flex items-center gap-1 text-neutral-500 text-sm">
        ♥ {count}
      </span>
    );
  }

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); // don't follow a parent <Link> when this sits inside a card
    e.stopPropagation();

    if (!user) {
      router.push('/login');
      return;
    }

    setBusy(true);
    const wasLiked = liked;
    // Optimistic update - feels instant, corrected below if the request fails.
    setLiked(!wasLiked);
    setCount((c) => c + (wasLiked ? -1 : 1));

    try {
      const result = wasLiked ? await unlikeListing(listingId) : await likeListing(listingId);
      setLiked(result.liked);
      setCount(result.likeCount);
    } catch {
      setLiked(wasLiked);
      setCount((c) => c + (wasLiked ? 1 : -1));
    } finally {
      setBusy(false);
    }
  }

  const sizeClass = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1 ${sizeClass} ${liked ? 'text-red-600' : 'text-neutral-500'} hover:text-red-600 disabled:opacity-60`}
    >
      <span>{liked ? '♥' : '♡'}</span>
      <span>{count}</span>
    </button>
  );
}
