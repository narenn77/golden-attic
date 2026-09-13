'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';
import { fetchConversations, type ConversationSummary } from '../../lib/conversations';

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchConversations()
      .then(setConversations)
      .catch(() => setError('Could not load your messages.'));
  }, [user]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-neutral-500 mb-4">Please log in to see your messages.</p>
        <Link href="/login" className="text-amber-700 font-semibold hover:underline">Log in</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>

      {error && <p className="text-red-600">{error}</p>}
      {conversations === null && !error && <p className="text-neutral-500">Loading...</p>}
      {conversations?.length === 0 && <p className="text-neutral-500">No conversations yet.</p>}

      <div className="space-y-2">
        {conversations?.map((c) => {
          const otherParty = c.buyerId === user.id ? c.seller : c.buyer;
          return (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className="flex items-center gap-3 border border-neutral-200 rounded-lg p-3 hover:bg-neutral-50"
            >
              <div className="w-14 h-14 bg-neutral-100 rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                {c.listing.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.listing.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-neutral-400 text-xs">No photo</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{otherParty.name}</span>
                  {c.unreadCount > 0 && (
                    <span className="bg-amber-700 text-white text-xs rounded-full px-2 py-0.5 shrink-0">{c.unreadCount}</span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 truncate">{c.listing.title}</p>
                {c.lastMessage && <p className="text-sm text-neutral-600 truncate">{c.lastMessage.body}</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
