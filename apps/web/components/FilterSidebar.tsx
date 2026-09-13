'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { ListingFilterOptions } from '../lib/listings';

function decadeLabel(decade: number) {
  return `${decade}s`;
}

function priceBandLabel(min: number, max: number | null) {
  return max == null ? `$${min}+` : `$${min} - $${max}`;
}

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="border-b border-neutral-200 py-3">
      <summary className="cursor-pointer font-medium text-sm text-neutral-800 select-none list-none flex items-center justify-between">
        {title}
        <span className="text-neutral-400">▾</span>
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

export default function FilterSidebar({ options }: { options: ListingFilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedCategories = (searchParams.get('category') || '').split(',').filter(Boolean);
  const selectedCountries = (searchParams.get('country') || '').split(',').filter(Boolean);
  const selectedDecade = searchParams.get('decade') || '';
  const selectedPriceBand =
    searchParams.get('minPrice') && searchParams.get('maxPrice')
      ? `${searchParams.get('minPrice')}-${searchParams.get('maxPrice')}`
      : '';

  function navigate(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleMultiValue(key: 'category' | 'country', value: string, currentlySelected: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    const next = currentlySelected.includes(value)
      ? currentlySelected.filter((v) => v !== value)
      : [...currentlySelected, value];
    if (next.length > 0) params.set(key, next.join(',')); else params.delete(key);
    navigate(params);
  }

  function setSingleValue(keys: string[], value: string) {
    const params = new URLSearchParams(searchParams.toString());
    keys.forEach((k) => params.delete(k));
    if (value) {
      if (keys.length === 1) {
        params.set(keys[0], value);
      } else {
        // price band: value is "min-max"
        const [min, max] = value.split('-');
        params.set('minPrice', min);
        params.set('maxPrice', max);
      }
    }
    navigate(params);
  }

  const decades: number[] = [];
  if (options.minYear != null && options.maxYear != null) {
    const startDecade = Math.floor(options.minYear / 10) * 10;
    const endDecade = Math.floor(options.maxYear / 10) * 10;
    for (let d = endDecade; d >= startDecade; d -= 10) decades.push(d);
  }

  const priceBands: Array<{ min: number; max: number }> = [];
  if (options.maxPrice != null) {
    const topBand = Math.ceil(options.maxPrice / 100) * 100;
    for (let band = 0; band < topBand; band += 100) priceBands.push({ min: band, max: band + 100 });
  }

  const hasActiveFilters = searchParams.toString().length > 0;

  return (
    <aside className="w-full md:w-56 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-sm text-neutral-900">Filters</h2>
        {hasActiveFilters && (
          <button onClick={() => router.push(pathname)} className="text-xs text-amber-700 underline">
            Clear all
          </button>
        )}
      </div>

      <FilterSection title="Category">
        {options.categories.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedCategories.includes(c)}
              onChange={() => toggleMultiValue('category', c, selectedCategories)}
              className="accent-amber-700"
            />
            {c}
          </label>
        ))}
      </FilterSection>

      {options.countries.length > 0 && (
        <FilterSection title="Country">
          {options.countries.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCountries.includes(c)}
                onChange={() => toggleMultiValue('country', c, selectedCountries)}
                className="accent-amber-700"
              />
              {c}
            </label>
          ))}
        </FilterSection>
      )}

      {decades.length > 0 && (
        <FilterSection title="Decade" defaultOpen={false}>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input type="radio" name="decade" checked={!selectedDecade} onChange={() => setSingleValue(['decade'], '')} className="accent-amber-700" />
            All decades
          </label>
          {decades.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
              <input
                type="radio"
                name="decade"
                checked={selectedDecade === String(d)}
                onChange={() => setSingleValue(['decade'], String(d))}
                className="accent-amber-700"
              />
              {decadeLabel(d)}
            </label>
          ))}
        </FilterSection>
      )}

      {priceBands.length > 0 && (
        <FilterSection title="Price" defaultOpen={false}>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="radio"
              name="priceBand"
              checked={!selectedPriceBand}
              onChange={() => setSingleValue(['minPrice', 'maxPrice'], '')}
              className="accent-amber-700"
            />
            All prices
          </label>
          {priceBands.map(({ min, max }) => (
            <label key={min} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
              <input
                type="radio"
                name="priceBand"
                checked={selectedPriceBand === `${min}-${max}`}
                onChange={() => setSingleValue(['minPrice', 'maxPrice'], `${min}-${max}`)}
                className="accent-amber-700"
              />
              {priceBandLabel(min, max)}
            </label>
          ))}
        </FilterSection>
      )}
    </aside>
  );
}
