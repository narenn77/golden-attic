import { vi } from 'vitest';

// Configurable per-test response for the AI listing draft call, so tests can
// exercise both the happy path and malformed/unparsable-response handling.
export const anthropicMockState = {
  responseText: JSON.stringify({
    title: 'Vintage 1952 US Stamp Collection',
    description: 'A small collection of vintage US postage stamps from the early 1950s, in good condition with light aging.',
    category: 'Stamps',
    suggestedPriceUsd: 45,
    confidence: 'medium',
  }),
};

export function resetAnthropicMockState() {
  anthropicMockState.responseText = JSON.stringify({
    title: 'Vintage 1952 US Stamp Collection',
    description: 'A small collection of vintage US postage stamps from the early 1950s, in good condition with light aging.',
    category: 'Stamps',
    suggestedPriceUsd: 45,
    confidence: 'medium',
  });
}

export const anthropic = {
  messages: {
    create: vi.fn(async (_params: any) => ({
      content: [{ type: 'text', text: anthropicMockState.responseText }],
    })),
  },
};

export const AI_LISTING_MODEL = 'claude-sonnet-4-6';
