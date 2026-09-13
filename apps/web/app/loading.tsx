export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="h-8 w-64 bg-neutral-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-96 bg-neutral-200 rounded animate-pulse mb-6" />
      <p className="text-sm text-neutral-400 mb-6">
        Loading... the backend may take up to a minute to wake up after a period of inactivity.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-56 bg-neutral-100 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
