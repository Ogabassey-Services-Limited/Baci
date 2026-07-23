import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('ai', () => ({
  generateObject: mocks.generateObject,
}));

// generateObjectWithChain (the real executor) constructs its default chain
// via @/ai/provider — extend rather than replace this mock so construction
// keeps working when a test exercises the real executor.
vi.mock('@/ai/provider', () => ({
  ACTIVE_TEXT_MODEL_NAME: 'gemini-2.5-flash',
  activeTextModel: { id: 'gemini-2.5-flash' },
  FALLBACK_TEXT_MODEL_NAME: 'gemini-2.5-flash-lite',
  fallbackTextModel: { id: 'gemini-2.5-flash-lite' },
  sanitizePromptInput: (value: string) => ({ value }),
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}));

vi.mock('@/config/business-types', () => ({
  getAIPromptContext: () => 'general e-commerce',
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { generateFAQ } from './generate-faq';

const validInput = {
  businessName: 'Baci Store',
  businessType: 'fashion',
  country: 'Nigeria',
};

const generatedFaqs = {
  faqs: [
    {
      question: 'Do you ship nationwide?',
      answer: 'Yes.',
      category: 'Shipping',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'Cards.',
      category: 'Payment',
    },
  ],
};

describe('generateFAQ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force the deterministic Gemini-only chain (no Cerebras/Groq keys) so
    // provider-count assertions below are stable regardless of ambient env.
    vi.stubEnv('CEREBRAS_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    mocks.generateObject.mockResolvedValue({ object: generatedFaqs });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a failure result without calling the AI model for invalid input', async () => {
    const result = await generateFAQ({ businessName: '' });

    expect(result.success).toBe(false);
    expect(result.faqs).toEqual([]);
    expect(result.error).toContain('Failed to generate FAQs');
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('generates FAQ items with sequential order on the happy path', async () => {
    const result = await generateFAQ(validInput);

    expect(result.success).toBe(true);
    expect(result.faqs).toHaveLength(2);
    expect(result.faqs[0]).toMatchObject({
      question: 'Do you ship nationwide?',
      answer: 'Yes.',
      category: 'Shipping',
      order: 0,
    });
    expect(result.faqs[0].id).toMatch(/^faq-/);
    expect(result.faqs[1]).toMatchObject({ order: 1 });
    expect(mocks.generateObject).toHaveBeenCalledTimes(1);
  });

  it('falls through to the next chain provider when the first one fails', async () => {
    mocks.generateObject
      .mockRejectedValueOnce(new Error('429 rate limited'))
      .mockResolvedValueOnce({ object: generatedFaqs });

    const result = await generateFAQ(validInput);

    expect(result.success).toBe(true);
    expect(result.faqs).toHaveLength(2);
    expect(mocks.generateObject).toHaveBeenCalledTimes(2);
  });

  it('returns a failure result with a stable error after every chain provider fails', async () => {
    mocks.generateObject.mockRejectedValue(new Error('model unavailable'));

    const result = await generateFAQ(validInput);

    expect(result.success).toBe(false);
    expect(result.faqs).toEqual([]);
    expect(result.error).toContain('Failed to generate FAQs');
    // Gemini-only chain in tests: both Gemini and Gemini-Lite are attempted
    // before the chain's exhaustion error reaches the flow's catch block.
    expect(mocks.generateObject).toHaveBeenCalledTimes(2);
  });

  it('returns a failure result when every provider returns an empty faqs array', async () => {
    mocks.generateObject.mockResolvedValue({ object: { faqs: [] } });

    const result = await generateFAQ(validInput);

    expect(result.success).toBe(false);
    expect(result.faqs).toEqual([]);
    expect(result.error).toContain('AI failed to generate FAQs');
  });
});
