import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY && process.env.NODE_ENV !== 'test') {
  console.warn('WARNING: ANTHROPIC_API_KEY is not set. AI listing generation will fail until it is configured.');
}

export const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY || 'not-configured',
});

export const AI_LISTING_MODEL = 'claude-sonnet-4-6';
