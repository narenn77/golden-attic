'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import FilterSidebar from './FilterSidebar';
import type { ListingFilterOptions } from '../lib/listings';

export default function FilterPanel({ options }: { options: ListingFilterOptions }) {
  const searchParams = useSearchParams();
  // Default closed - avoids a layout jump on mobile where the panel used to
  // push the listings grid far down the page. Opens automatically on wider
  // screens after mount, since there's room for it to sit comfortably.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setOpen(true);
    }
  }, []);

  const activeFilterCount = Array.from(searchParams.keys()).filter((k) =>
    ['category', 'country', 'decade', 'minPrice'].includes(k)
  ).length;

  return (
    <div className="md:w-56 shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full md:hidden flex items-center justify-between border border-neutral-300 rounded-md px-4 py-2.5 mb-3 bg-white"
      >
        <span className="font-medium text-sm flex items-center gap-2">
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-amber-700 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </span>
        <span className="text-neutral-400">{open ? '▴' : '▾'}</span>
      </button>

      <div className={open ? 'block' : 'hidden md:block'}>
        <FilterSidebar options={options} />
      </div>
    </div>
  );
}
