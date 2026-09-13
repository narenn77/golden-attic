'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { requestAiDraft, createListing, publishListing, type AiListingDraft } from '../../lib/listings';
import { ApiError } from '../../lib/client';

const MAX_IMAGES = 5;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SellPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<AiListingDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [year, setYear] = useState('');
  const [country, setCountry] = useState('');
  const [weightOz, setWeightOz] = useState('');

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const room = MAX_IMAGES - images.length;
    const toAdd = files.slice(0, room);
    const dataUrls = await Promise.all(toAdd.map(fileToDataUrl));
    setImages((prev) => [...prev, ...dataUrls]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function generateDraft() {
    if (images.length === 0) {
      setError('Add at least one photo of your item first.');
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      const { draft } = await requestAiDraft({ images, note: note.trim() || undefined });
      setDraft(draft);
      setTitle(draft.title);
      setDescription(draft.description);
      setCategory(draft.category);
      setPrice(String(draft.suggestedPriceUsd));
      setYear(draft.year != null ? String(draft.year) : '');
      setCountry(draft.country || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate a draft. You can still fill in the details below yourself.');
    } finally {
      setDrafting(false);
    }
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    const priceNumber = parseFloat(price);
    if (!title.trim() || !description.trim() || !category.trim() || !priceNumber || priceNumber <= 0) {
      setError('Please fill in a title, description, category, and a valid price.');
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const listing = await createListing({
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        price: priceNumber,
        images,
        aiGenerated: draft !== null,
        year: year.trim() ? parseInt(year.trim(), 10) : null,
        country: country.trim() || null,
        weightOz: weightOz.trim() ? parseInt(weightOz.trim(), 10) : null,
      });
      await publishListing(listing.id);
      router.push(`/listing/${listing.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not publish. Please try again.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Sell an item</h1>
      <p className="text-neutral-500 mb-6">
        Add a few photos and let AI draft the listing for you — including year and country of origin for stamps, coins, and currency.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        {images.map((src, i) => (
          <div key={i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-20 h-20 object-cover rounded-md" />
            <button
              onClick={() => removeImage(i)}
              className="absolute -top-2 -right-2 bg-neutral-800 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 border-2 border-dashed border-neutral-300 rounded-md text-xs text-neutral-500 hover:border-amber-500"
          >
            + Add Photo
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelected} className="hidden" />
      </div>

      <textarea
        placeholder="Anything you know about it? (optional) e.g. 'found in grandma's attic, 1950s stamps'"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full border border-neutral-300 rounded-md px-4 py-3 mb-4 min-h-[70px]"
      />

      <button
        onClick={generateDraft}
        disabled={drafting}
        className="w-full bg-violet-700 text-white rounded-md py-3 font-semibold hover:bg-violet-800 disabled:opacity-60 mb-2"
      >
        {drafting ? 'Drafting...' : '✨ Draft listing with AI'}
      </button>

      {draft?.confidence === 'low' && (
        <p className="text-sm text-amber-800 italic mb-4">
          The AI wasn&apos;t fully sure about this item — please double check the details below before publishing.
        </p>
      )}

      <h2 className="font-semibold mt-6 mb-3 text-neutral-700">Review &amp; edit before publishing</h2>

      <form onSubmit={handlePublish} className="space-y-3">
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-4 py-3"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-4 py-3 min-h-[100px]"
        />
        <input
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-4 py-3"
        />
        <div className="flex gap-3">
          <input
            type="number"
            placeholder="Year (optional)"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="flex-1 border border-neutral-300 rounded-md px-4 py-3"
          />
          <input
            placeholder="Country of origin (optional)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="flex-1 border border-neutral-300 rounded-md px-4 py-3"
          />
        </div>
        <input
          type="number"
          placeholder="Package weight in ounces (optional, helps estimate shipping)"
          value={weightOz}
          onChange={(e) => setWeightOz(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-4 py-3"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price ($)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-4 py-3"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={publishing}
          className="w-full bg-amber-700 text-white rounded-md py-3 font-semibold hover:bg-amber-800 disabled:opacity-60"
        >
          {publishing ? 'Publishing...' : 'Publish Listing'}
        </button>
      </form>
    </div>
  );
}
