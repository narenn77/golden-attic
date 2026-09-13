'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { ListingFilterOptions } from '../lib/listings';

const SORT_LABELS: Record<string, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  year_newest: 'Year: newest first',
  year_oldest: 'Year: oldest first',
};

function decadeLabel(decade: number) {
  return `${decade}s`;
}

function priceBandLabel(min: number, max: number | null) {
  return max == null ? `$${min}+` : `$${min} - $${max}`;
}

export default function FilterBar({ options }: { options: ListingFilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Build decade options from the actual range of years in use, newest first.
  const decades: number[] = [];
  if (options.minYear != null && options.maxYear != null) {
    const startDecade = Math.floor(options.minYear / 10) * 10;
    const endDecade = Math.floor(options.maxYear / 10) * 10;
    for (let d = endDecade; d >= startDecade; d -= 10) decades.push(d);
  }

  // Build $100-wide price bands from 0 up to the current highest listing price.
  const priceBands: Array<{ min: number; max: number | null }> = [];
  if (options.maxPrice != null) {
    const topBand = Math.ceil(options.maxPrice / 100) * 100;
    for (let band = 0; band < topBand; band += 100) {
      priceBands.push({ min: band, max: band + 100 });
    }
  }

  const selectClass = 'border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white';

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <select
        className={selectClass}
        value={searchParams.get('category') || ''}
        onChange={(e) => updateParam('category', e.target.value)}
      >
        <option value="">All categories</option>
        {options.categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {options.countries.length > 0 && (
        <select
          className={selectClass}
          value={searchParams.get('country') || ''}
          onChange={(e) => updateParam('country', e.target.value)}
        >
          <option value="">All countries</option>
          {options.countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      {decades.length > 0 && (
        <select
          className={selectClass}
          value={searchParams.get('decade') || ''}
          onChange={(e) => updateParam('decade', e.target.value)}
        >
          <option value="">All decades</option>
          {decades.map((d) => (
            <option key={d} value={d}>{decadeLabel(d)}</option>
          ))}
        </select>
      )}

      {priceBands.length > 0 && (
        <select
          className={selectClass}
          value={
            searchParams.get('minPrice') && searchParams.get('maxPrice')
              ? `${searchParams.get('minPrice')}-${searchParams.get('maxPrice')}`
              : ''
          }
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) {
              const [min, max] = e.target.value.split('-');
              params.set('minPrice', min);
              params.set('maxPrice', max);
            } else {
              params.delete('minPrice');
              params.delete('maxPrice');
            }
            router.push(`${pathname}?${params.toString()}`);
          }}
        >
          <option value="">All prices</option>
          {priceBands.map(({ min, max }) => (
            <option key={min} value={`${min}-${max}`}>{priceBandLabel(min, max)}</option>
          ))}
        </select>
      )}

      <select
        className={selectClass}
        value={searchParams.get('sort') || 'newest'}
        onChange={(e) => updateParam('sort', e.target.value)}
      >
        {Object.entries(SORT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      {searchParams.toString() && (
        <button
          onClick={() => router.push(pathname)}
          className="text-sm text-neutral-500 underline px-2"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
