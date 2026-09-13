'use client';

export default function RatingStars({
  value,
  onChange,
  readOnly = false,
  size = 'md',
}: {
  value: number;
  onChange?: (score: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md';
}) {
  const starSize = size === 'sm' ? 'text-sm' : 'text-2xl';

  return (
    <div className={`flex gap-1 ${starSize}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
        >
          <span className={n <= value ? 'text-amber-500' : 'text-neutral-300'}>★</span>
        </button>
      ))}
    </div>
  );
}
