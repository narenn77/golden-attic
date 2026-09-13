'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';
import { fetchMyOrders, completeOrder, type Order } from '../../lib/orders';
import { rateOrder, fetchRatingEligibility, type RatingEligibility } from '../../lib/ratings';
import RatingStars from '../../components/RatingStars';
import { ApiError } from '../../lib/client';

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment', PAID: 'Paid', SHIPPED: 'Shipped',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', REFUNDED: 'Refunded',
};

function OrderRow({ order, currentUserId, onUpdated }: { order: Order; currentUserId: string; onUpdated: () => void }) {
  const isBuyer = order.buyerId === currentUserId;
  const otherParty = isBuyer ? order.seller : order.buyer;

  const [completing, setCompleting] = useState(false);
  const [eligibility, setEligibility] = useState<RatingEligibility | null>(null);
  const [showRateForm, setShowRateForm] = useState(false);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order.status === 'COMPLETED') {
      fetchRatingEligibility(order.id).then(setEligibility).catch(() => {});
    }
  }, [order.id, order.status]);

  async function handleComplete() {
    setCompleting(true);
    setError(null);
    try {
      await completeOrder(order.id);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm receipt.');
    } finally {
      setCompleting(false);
    }
  }

  async function handleSubmitRating() {
    setSubmittingRating(true);
    setError(null);
    try {
      await rateOrder(order.id, score, comment.trim() || undefined);
      setShowRateForm(false);
      setEligibility({ eligible: false, alreadyRated: true, orderStatus: order.status });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit rating.');
    } finally {
      setSubmittingRating(false);
    }
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-4">
      <div className="flex gap-3">
        <Link href={`/listing/${order.listingId}`} className="shrink-0">
          <div className="w-16 h-16 bg-neutral-100 rounded-md overflow-hidden flex items-center justify-center">
            {order.listing?.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={order.listing.images[0]} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-neutral-400 text-xs">No photo</span>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <Link href={`/listing/${order.listingId}`} className="font-medium truncate hover:underline">
              {order.listing?.title || 'Item'}
            </Link>
            <span className="text-xs text-neutral-500 shrink-0 ml-2">{STATUS_LABELS[order.status]}</span>
          </div>
          <p className="text-sm text-neutral-500">
            {isBuyer ? 'Bought from' : 'Sold to'} {otherParty?.name} · ${Number(order.amount).toFixed(2)}
            {order.shippingCost && Number(order.shippingCost) > 0 ? ` + $${Number(order.shippingCost).toFixed(2)} shipping` : ''}
          </p>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {isBuyer && order.status === 'PAID' && (
        <button
          onClick={handleComplete}
          disabled={completing}
          className="mt-3 text-sm bg-green-700 text-white rounded-md px-4 py-2 font-semibold hover:bg-green-800 disabled:opacity-60"
        >
          {completing ? 'Confirming...' : 'Confirm receipt'}
        </button>
      )}

      {eligibility?.eligible && !showRateForm && (
        <button
          onClick={() => setShowRateForm(true)}
          className="mt-3 text-sm border border-amber-700 text-amber-700 rounded-md px-4 py-2 font-semibold hover:bg-amber-50"
        >
          Rate this transaction
        </button>
      )}

      {eligibility?.alreadyRated && <p className="mt-3 text-sm text-neutral-500">You&apos;ve rated this transaction. Thanks!</p>}

      {showRateForm && (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <RatingStars value={score} onChange={setScore} />
          <textarea
            placeholder="Optional comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm mt-2"
            rows={2}
          />
          <button
            onClick={handleSubmitRating}
            disabled={submittingRating}
            className="mt-2 bg-amber-700 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-amber-800 disabled:opacity-60"
          >
            {submittingRating ? 'Submitting...' : 'Submit rating'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyOrders();
      setOrders(data);
    } catch {
      setError('Could not load your orders.');
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-neutral-500 mb-4">Please log in to see your orders.</p>
        <Link href="/login" className="text-amber-700 font-semibold hover:underline">Log in</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      {error && <p className="text-red-600">{error}</p>}
      {orders === null && !error && <p className="text-neutral-500">Loading...</p>}
      {orders?.length === 0 && <p className="text-neutral-500">No orders yet.</p>}

      <div className="space-y-3">
        {orders?.map((order) => (
          <OrderRow key={order.id} order={order} currentUserId={user.id} onUpdated={load} />
        ))}
      </div>
    </div>
  );
}
