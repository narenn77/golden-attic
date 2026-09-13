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

// A "clear this facet" row shown at the top of every section - always
// present regardless of how many actual values there are, so every filter
// has a consistent, obvious way back to "no restriction on this facet."
function AllOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block text-sm text-left ${active ? 'font-semibold text-amber-700' : 'text-neutral-500 hover:text-neutral-800'}`}
    >
      {label}
    </button>
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

  function clearFacet(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
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
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-sm text-neutral-900">Filters</h2>
        {hasActiveFilters && (
          <button onClick={() => router.push(pathname)} className="text-xs text-amber-700 underline">
            Clear all
          </button>
        )}
      </div>

      <FilterSection title="Category">
        <AllOption label="All categories" active={selectedCategories.length === 0} onClick={() => clearFacet('category')} />
        {options.categories.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedCategories.includes(c)}
              onChange={() => toggleMultiValue('category', c, selectedCategories)}
              className="accent-amber-700 [color-scheme:light]"
            />
            {c}
          </label>
        ))}
      </FilterSection>

      <FilterSection title="Country">
        <AllOption label="All countries" active={selectedCountries.length === 0} onClick={() => clearFacet('country')} />
        {options.countries.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedCountries.includes(c)}
              onChange={() => toggleMultiValue('country', c, selectedCountries)}
              className="accent-amber-700 [color-scheme:light]"
            />
            {c}
          </label>
        ))}
        {options.countries.length === 0 && (
          <p className="text-xs text-neutral-400">No countries listed yet.</p>
        )}
      </FilterSection>

      <FilterSection title="Decade" defaultOpen={false}>
        <AllOption label="All decades" active={!selectedDecade} onClick={() => clearFacet('decade')} />
        {decades.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="radio"
              name="decade"
              checked={selectedDecade === String(d)}
              onChange={() => setSingleValue(['decade'], String(d))}
              className="accent-amber-700 [color-scheme:light]"
            />
            {decadeLabel(d)}
          </label>
        ))}
        {decades.length === 0 && <p className="text-xs text-neutral-400">No dated listings yet.</p>}
      </FilterSection>

      <FilterSection title="Price" defaultOpen={false}>
        <AllOption
          label="All prices"
          active={!selectedPriceBand}
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('minPrice');
            params.delete('maxPrice');
            navigate(params);
          }}
        />
        {priceBands.map(({ min, max }) => (
          <label key={min} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="radio"
              name="priceBand"
              checked={selectedPriceBand === `${min}-${max}`}
              onChange={() => setSingleValue(['minPrice', 'maxPrice'], `${min}-${max}`)}
              className="accent-amber-700 [color-scheme:light]"
            />
            {priceBandLabel(min, max)}
          </label>
        ))}
        {priceBands.length === 0 && <p className="text-xs text-neutral-400">No listings yet.</p>}
      </FilterSection>
    </div>
  );
}
