'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createOrder, fetchOrder } from '../../../lib/orders';
import { createCheckoutIntent } from '../../../lib/payments';
import { ApiError } from '../../../lib/client';

// TODO: replace with the real Stripe publishable key once the Stripe account is set up.
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder_not_configured'
);

function PayButton({ title, price }: { title: string; price: string }) {
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
        {paying ? 'Processing...' : `Pay $${Number(price).toFixed(2)}`}
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const prepare = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let order;
      if (params.orderId === 'new') {
        const listingId = searchParams.get('listingId');
        const priceParam = searchParams.get('price');
        const titleParam = searchParams.get('title') || 'Item';
        if (!listingId || !priceParam) {
          setError('Missing checkout details.');
          setLoading(false);
          return;
        }
        order = await createOrder({ listingId, amount: Number(priceParam) });
        setTitle(titleParam);
        setPrice(order.amount);
      } else {
        order = await fetchOrder(params.orderId);
        setTitle('Your order');
        setPrice(order.amount);
      }

      const { clientSecret } = await createCheckoutIntent(order.id);
      setClientSecret(clientSecret);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [params.orderId, searchParams]);

  useEffect(() => {
    prepare();
  }, [prepare]);

  if (loading) {
    return <div className="max-w-md mx-auto px-4 py-16 text-center text-neutral-500">Preparing checkout...</div>;
  }

  if (error || !clientSecret) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-4">{error || 'Something went wrong.'}</p>
        <button onClick={prepare} className="text-amber-700 font-semibold hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-amber-50 rounded-lg p-5 mb-6">
        <p className="text-xs text-amber-700 mb-1">You&apos;re buying</p>
        <p className="font-bold text-lg">{title}</p>
        <p className="text-2xl font-bold text-amber-700 mt-1">${Number(price).toFixed(2)}</p>
      </div>

      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <PaymentElement />
        <PayButton title={title} price={price} />
      </Elements>

      <p className="text-xs text-neutral-400 text-center mt-6">Payments are securely processed by Stripe.</p>
    </div>
  );
}
