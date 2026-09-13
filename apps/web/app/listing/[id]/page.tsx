import { fetchListing } from '../../../lib/listings';
import ListingDetailClient from './ListingDetailClient';

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const listing = await fetchListing(id);
    return <ListingDetailClient listing={listing} />;
  } catch {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-neutral-500">
        Listing not found.
      </div>
    );
  }
}
