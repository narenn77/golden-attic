import { fetchListings, fetchListingFilterOptions, type ListingSort } from '../lib/listings';
import ListingCard from '../components/ListingCard';
import FilterSidebar from '../components/FilterSidebar';
import SortDropdown from '../components/SortDropdown';

export const dynamic = 'force-dynamic'; // listings and filters change often, avoid stale static caching

interface HomePageProps {
  searchParams: Promise<{
    category?: string;
    country?: string;
    decade?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;

  let listings: Awaited<ReturnType<typeof fetchListings>> = [];
  let filterOptions: Awaited<ReturnType<typeof fetchListingFilterOptions>> | null = null;
  let loadError = false;

  try {
    [listings, filterOptions] = await Promise.all([
      fetchListings({
        category: params.category,
        country: params.country,
        decade: params.decade ? parseInt(params.decade, 10) : undefined,
        minPrice: params.minPrice ? parseFloat(params.minPrice) : undefined,
        maxPrice: params.maxPrice ? parseFloat(params.maxPrice) : undefined,
        sort: (params.sort as ListingSort) || undefined,
      }),
      fetchListingFilterOptions(),
    ]);
  } catch {
    loadError = true;
  }

  const hasActiveFilters = !!(params.category || params.country || params.decade || params.minPrice);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Browse collectibles</h1>
      <p className="text-neutral-500 mb-6">Stamps, coins, vintage toys, and more from real sellers.</p>

      {loadError && (
        <p className="text-red-600 mb-6">Could not load listings right now. Please try again shortly.</p>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {filterOptions && <FilterSidebar options={filterOptions} />}

        <div className="flex-1 min-w-0">
          <div className="flex justify-end mb-4">
            <SortDropdown />
          </div>

          {!loadError && listings.length === 0 && (
            <p className="text-neutral-500">
              {hasActiveFilters ? 'No listings match these filters.' : 'No listings yet. Be the first to sell something!'}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
