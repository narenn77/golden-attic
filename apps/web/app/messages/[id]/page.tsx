'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../lib/AuthContext';
import { fetchMessages, sendMessage, type Message, type ConversationSummary } from '../../../lib/conversations';
import { ApiError } from '../../../lib/client';

const POLL_INTERVAL_MS = 4000;

export default function ConversationThreadPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMessages(params.id);
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch {
      setError('Could not load this conversation.');
    }
  }, [params.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(params.id, draft.trim());
      setDraft('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that message.');
    } finally {
      setSending(false);
    }
  }

  if (!conversation) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-neutral-500">{error || 'Loading...'}</div>;
  }

  const otherParty = conversation.buyerId === user?.id ? conversation.seller : conversation.buyer;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b border-neutral-200 pb-3 mb-3">
        <Link href="/messages" className="text-sm text-amber-700 hover:underline">← Messages</Link>
        <div className="flex items-center gap-2 mt-2">
          <h1 className="font-semibold">{otherParty.name}</h1>
          <span className="text-neutral-400">·</span>
          <Link href={`/listing/${conversation.listing.id}`} className="text-sm text-neutral-500 hover:underline truncate">
            {conversation.listing.title}
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pb-3">
        {messages.map((m) => {
          const isMe = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  isMe ? 'bg-amber-700 text-white' : 'bg-neutral-100 text-neutral-800'
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-neutral-200 pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border border-neutral-300 rounded-md px-4 py-2"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="bg-amber-700 text-white rounded-md px-5 font-semibold hover:bg-amber-800 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
