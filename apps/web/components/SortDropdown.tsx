'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const SORT_LABELS: Record<string, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  year_newest: 'Year: newest first',
  year_oldest: 'Year: oldest first',
  most_liked: 'Most liked',
};

export default function SortDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white text-neutral-900 [color-scheme:light]"
      value={searchParams.get('sort') || 'newest'}
      onChange={(e) => updateSort(e.target.value)}
    >
      {Object.entries(SORT_LABELS).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
