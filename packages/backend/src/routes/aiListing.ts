import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { anthropic, AI_LISTING_MODEL } from '../lib/anthropic.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { LISTING_CATEGORIES } from '@golden-attic/shared';

export const aiListingRouter = Router();

// AI calls cost real money per request - cap how often one user can draft.
// (Disabled in the test environment - see auth.ts for the same pattern.)
const aiDraftLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 100000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many AI drafting requests this hour. Please try again later.' } },
});

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // ~8MB per image, matches Anthropic's per-image limit headroom

interface ImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  base64: string;
}

function parseDataUrl(dataUrl: string): ImageInput | null {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mediaType: match[1] as ImageInput['mediaType'], base64: match[2] };
}

interface AiDraftResult {
  title: string;
  description: string;
  category: string;
  suggestedPriceUsd: number;
  confidence: 'low' | 'medium' | 'high';
  year: number | null;
  country: string | null;
}

function extractJson(text: string): unknown {
  // Model is instructed to return raw JSON, but strip code fences defensively
  // in case it wraps the response anyway.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

const CURRENT_YEAR = new Date().getFullYear();

function validateDraft(parsed: any): AiDraftResult {
  const title = typeof parsed.title === 'string' ? parsed.title.slice(0, 120) : 'Untitled item';
  const description = typeof parsed.description === 'string' ? parsed.description.slice(0, 2000) : '';
  const category = LISTING_CATEGORIES.includes(parsed.category) ? parsed.category : 'Other Collectibles';
  const suggestedPriceUsd = typeof parsed.suggestedPriceUsd === 'number' && parsed.suggestedPriceUsd > 0
    ? Math.round(parsed.suggestedPriceUsd * 100) / 100
    : 0;
  const confidence: AiDraftResult['confidence'] = ['low', 'medium', 'high'].includes(parsed.confidence)
    ? parsed.confidence
    : 'low';
  const year = typeof parsed.year === 'number' && parsed.year >= 1000 && parsed.year <= CURRENT_YEAR
    ? Math.round(parsed.year)
    : null;
  const country = typeof parsed.country === 'string' && parsed.country.trim()
    ? parsed.country.trim().slice(0, 100)
    : null;

  return { title, description, category, suggestedPriceUsd, confidence, year, country };
}

// POST /listings/ai-draft
// Body: { images: string[] (data URLs), note?: string }
// Returns a draft the seller can review/edit before publishing - this never
// creates a listing directly, since the target audience (retirees downsizing
// collections) needs to be able to correct anything the model gets wrong.
aiListingRouter.post('/ai-draft', requireAuth, aiDraftLimiter, asyncHandler(async (req, res) => {
  const { images, note } = req.body as { images?: string[]; note?: string };

  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: { message: 'At least one image is required' } });
  }
  if (images.length > MAX_IMAGES) {
    return res.status(400).json({ error: { message: `At most ${MAX_IMAGES} images are allowed` } });
  }

  const parsedImages: ImageInput[] = [];
  for (const img of images) {
    const parsed = parseDataUrl(img);
    if (!parsed) {
      return res.status(400).json({ error: { message: 'Images must be base64 data URLs (image/jpeg, png, webp, or gif)' } });
    }
    if (Buffer.byteLength(parsed.base64, 'base64') > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: { message: 'One or more images exceed the 8MB size limit' } });
    }
    parsedImages.push(parsed);
  }

  const systemPrompt = `You are helping a seller on Golden Attic, a marketplace for collectibles and used items, draft a listing from photos of their item. Their target audience is often retirees who are not tech-savvy, so keep the description clear, honest, and easy to read.

Look at the photo(s) and produce a draft listing. Respond with ONLY a raw JSON object (no markdown, no code fences, no commentary) with exactly these fields:
{
  "title": string (concise, descriptive, under 100 characters),
  "description": string (2-4 sentences: what it is, condition, any notable details visible in the photo),
  "category": string (must be exactly one of: ${LISTING_CATEGORIES.join(', ')}),
  "suggestedPriceUsd": number (a reasonable estimated resale price in US dollars based on what's visible - a rough estimate, not an appraisal),
  "confidence": "low" | "medium" | "high" (your confidence in this identification and price estimate),
  "year": number or null (the year of issue/manufacture, if visible or confidently inferable - this is especially important and often visible for stamps, coins, and currency; use null rather than guessing if you can't support it from the image),
  "country": string or null (the country of origin/issue, if visible or confidently inferable - also especially relevant for stamps, coins, and currency; use null rather than guessing)
}

If you cannot clearly identify the item, still provide your best-effort draft with "confidence": "low" and say so plainly in the description rather than guessing specifics you can't support from the image. Leave "year" and "country" as null whenever they aren't visibly supported - do not fabricate them just to fill the fields.`;

  const userNote = note?.trim()
    ? `The seller added this note about the item: "${note.trim()}"`
    : 'The seller did not add any additional notes.';

  const response = await anthropic.messages.create({
    model: AI_LISTING_MODEL,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          ...parsedImages.map((img) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
          })),
          { type: 'text' as const, text: userNote },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return res.status(502).json({ error: { message: 'AI service returned no usable response' } });
  }

  let draft: AiDraftResult;
  try {
    const parsed = extractJson(textBlock.text);
    draft = validateDraft(parsed);
  } catch (err) {
    console.error('Failed to parse AI listing draft JSON:', err, textBlock.text);
    return res.status(502).json({ error: { message: 'Could not parse AI-generated draft. Please try again.' } });
  }

  res.json({ draft });
}));
