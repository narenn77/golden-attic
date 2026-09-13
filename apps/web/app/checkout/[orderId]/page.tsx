'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createOrder, fetchOrder, fetchShippingQuote, type ShippingQuote } from '../../../lib/orders';
import { createCheckoutIntent } from '../../../lib/payments';
import { ApiError } from '../../../lib/client';

// TODO: replace with the real Stripe publishable key once the Stripe account is set up.
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder_not_configured'
);

function PayButton({ total }: { total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Payment failed. Please try again.');
      setPaying(false);
      return;
    }

    router.push('/checkout/success');
  }

  return (
    <div className="mt-6">
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <button
        onClick={handlePay}
        disabled={paying || !stripe}
        className="w-full bg-amber-700 text-white rounded-md py-3 font-semibold hover:bg-amber-800 disabled:opacity-60"
      >
        {paying ? 'Processing...' : `Pay $${total.toFixed(2)}`}
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [itemPrice, setItemPrice] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Shipping-choice phase (only for brand-new checkouts)
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [localPickup, setLocalPickup] = useState(false);
  const [confirmingShipping, setConfirmingShipping] = useState(false);

  const isNew = params.orderId === 'new';
  const listingId = searchParams.get('listingId');
  const titleParam = searchParams.get('title') || 'Item';
  const priceParam = searchParams.get('price');

  const loadQuote = useCallback(async () => {
    if (!isNew || !listingId) return;
    setLoading(true);
    setError(null);
    try {
      const q = await fetchShippingQuote(listingId);
      setQuote(q);
      setLocalPickup(q.localPickupEligible); // default to pickup when it's plausible - usually cheaper/faster
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load shipping options.');
    } finally {
      setLoading(false);
    }
  }, [isNew, listingId]);

  const loadExistingOrder = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError(null);
    try {
      const order = await fetchOrder(params.orderId);
      setTitle('Your order');
      setItemPrice(Number(order.amount));
      setShippingCost(Number(order.shippingCost ?? 0));
      const { clientSecret } = await createCheckoutIntent(order.id);
      setClientSecret(clientSecret);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isNew, params.orderId]);

  useEffect(() => {
    if (isNew) loadQuote();
    else loadExistingOrder();
  }, [isNew, loadQuote, loadExistingOrder]);

  async function handleConfirmShipping() {
    if (!listingId) return;
    setConfirmingShipping(true);
    setError(null);
    try {
      const order = await createOrder({ listingId, localPickup });
      setTitle(titleParam);
      setItemPrice(Number(order.amount));
      setShippingCost(Number(order.shippingCost ?? 0));

      const { clientSecret } = await createCheckoutIntent(order.id);
      setClientSecret(clientSecret);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout. Please try again.');
    } finally {
      setConfirmingShipping(false);
    }
  }

  if (loading) {
    return <div className="max-w-md mx-auto px-4 py-16 text-center text-neutral-500">Preparing checkout...</div>;
  }

  if (error && !clientSecret) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => (isNew ? loadQuote() : loadExistingOrder())} className="text-amber-700 font-semibold hover:underline">
          Try again
        </button>
      </div>
    );
  }

  // Phase 1: shipping choice, before an order exists yet.
  if (isNew && !clientSecret) {
    const price = priceParam ? Number(priceParam) : 0;
    const shipCost = quote?.shippingCost ?? 0;
    const total = localPickup ? price : price + shipCost;

    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-amber-50 rounded-lg p-5 mb-6">
          <p className="text-xs text-amber-700 mb-1">You&apos;re buying</p>
          <p className="font-bold text-lg">{titleParam}</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">${price.toFixed(2)}</p>
        </div>

        <h2 className="font-semibold mb-3">Delivery</h2>

        {quote?.localPickupEligible && (
          <label className="flex items-start gap-3 border border-neutral-200 rounded-md p-3 mb-2 cursor-pointer">
            <input type="radio" checked={localPickup} onChange={() => setLocalPickup(true)} className="mt-1 accent-amber-700 [color-scheme:light]" />
            <div>
              <p className="font-medium text-sm">Local pickup</p>
              <p className="text-xs text-neutral-500">
                The seller is near you (around {quote.sellerCity}, {quote.sellerState}). Free - message them to arrange a time and place.
              </p>
            </div>
          </label>
        )}

        <label className="flex items-start gap-3 border border-neutral-200 rounded-md p-3 mb-6 cursor-pointer">
          <input type="radio" checked={!localPickup} onChange={() => setLocalPickup(false)} className="mt-1 accent-amber-700 [color-scheme:light]" />
          <div>
            <p className="font-medium text-sm">Ship to my address</p>
            <p className="text-xs text-neutral-500">
              {quote ? `${quote.service} — est. $${quote.shippingCost.toFixed(2)}` : 'Calculating...'}
              {' '}(uses the address saved in your profile)
            </p>
          </div>
        </label>

        <div className="flex justify-between text-sm text-neutral-600 mb-1">
          <span>Item</span>
          <span>${price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-neutral-600 mb-3">
          <span>Shipping</span>
          <span>{localPickup ? 'Free (pickup)' : `$${shipCost.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between font-bold text-lg mb-6 border-t border-neutral-200 pt-3">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <button
          onClick={handleConfirmShipping}
          disabled={confirmingShipping}
          className="w-full bg-amber-700 text-white rounded-md py-3 font-semibold hover:bg-amber-800 disabled:opacity-60"
        >
          {confirmingShipping ? 'Continuing...' : 'Continue to payment'}
        </button>

        {!localPickup && (
          <p className="text-xs text-neutral-400 text-center mt-3">
            No saved address?{' '}
            <button onClick={() => router.push('/profile')} className="underline">
              Add one to your profile
            </button>{' '}
            first.
          </p>
        )}
      </div>
    );
  }

  // Phase 2: payment, once an order + PaymentIntent exist.
  if (!clientSecret) return null;

  const total = itemPrice + shippingCost;

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-amber-50 rounded-lg p-5 mb-6">
        <p className="text-xs text-amber-700 mb-1">{title}</p>
        <div className="flex justify-between text-sm text-neutral-700 mt-2">
          <span>Item</span>
          <span>${itemPrice.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-neutral-700">
          <span>Shipping</span>
          <span>{shippingCost > 0 ? `$${shippingCost.toFixed(2)}` : 'Free (pickup)'}</span>
        </div>
        <div className="flex justify-between font-bold text-amber-700 mt-2 pt-2 border-t border-amber-200">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <PaymentElement />
        <PayButton total={total} />
      </Elements>

      <p className="text-xs text-neutral-400 text-center mt-6">Payments are securely processed by Stripe.</p>
    </div>
  );
}
