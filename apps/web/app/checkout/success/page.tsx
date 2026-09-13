import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-green-700 mb-3">Payment successful!</h1>
      <p className="text-neutral-600 mb-8">Thanks for your purchase. The seller has been notified.</p>
      <Link href="/" className="text-amber-700 font-semibold hover:underline">
        Continue browsing
      </Link>
    </div>
  );
}
