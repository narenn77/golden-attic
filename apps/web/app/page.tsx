import { fetchListings } from '../lib/listings';
import ListingCard from '../components/ListingCard';

export const dynamic = 'force-dynamic'; // listings change often, avoid stale static caching

export default async function HomePage() {
  let listings: Awaited<ReturnType<typeof fetchListings>> = [];
  let loadError = false;

  try {
    listings = await fetchListings();
  } catch {
    loadError = true;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Browse collectibles</h1>
      <p className="text-neutral-500 mb-6">Stamps, coins, vintage toys, and more from real sellers.</p>

      {loadError && (
        <p className="text-red-600 mb-6">Could not load listings right now. Please try again shortly.</p>
      )}

      {!loadError && listings.length === 0 && (
        <p className="text-neutral-500">No listings yet. Be the first to sell something!</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}
