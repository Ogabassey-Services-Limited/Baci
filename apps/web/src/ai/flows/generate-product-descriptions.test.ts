import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  generateText: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('ai', () => ({ generateText: mocks.generateText }));

// generateTextWithChain (the real executor) constructs its default chain via
// @/ai/provider — extend rather than replace this mock so that construction
// keeps working when a test exercises the real executor instead of mocking
// '@/ai/generate-text-with-chain' directly.
vi.mock('@/ai/provider', () => ({
  ACTIVE_TEXT_MODEL_NAME: 'gemini-2.5-flash',
  activeTextModel: { id: 'gemini-2.5-flash' },
  FALLBACK_TEXT_MODEL_NAME: 'gemini-2.5-flash-lite',
  fallbackTextModel: { id: 'gemini-2.5-flash-lite' },
  sanitizePromptInput: (value: string) => ({ value }),
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock('@/lib/merchant-server', () => {
  class MerchantPermissionDeniedError extends Error {
    constructor(resource: string, action: string) {
      super(`Permission denied: ${action} access to ${resource} is required`);
      this.name = 'MerchantPermissionDeniedError';
    }
  }
  return {
    MerchantPermissionDeniedError,
    ensurePermission: mocks.ensurePermission,
    isMerchantPermissionRedirectError: (error: unknown) =>
      error instanceof MerchantPermissionDeniedError,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mocks.getUser },
  })),
}));

import { MerchantPermissionDeniedError } from '@/lib/merchant-server';
import { generateProductDescription } from './generate-product-descriptions';

describe('generateProductDescription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Force the deterministic Gemini-only chain (no Cerebras/Groq keys) so
    // provider-count assertions below are stable regardless of ambient env.
    vi.stubEnv('CEREBRAS_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.ensurePermission.mockResolvedValue({
      merchant: { id: 'merchant-1' },
      staffAccess: { isOwner: true },
    });
    mocks.generateText.mockResolvedValue({ text: 'A lovely tote bag.' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unauthenticated callers without calling the AI model', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      generateProductDescription({ productName: 'Tote Bag' })
    ).rejects.toThrow(
      'You must be signed in to generate product descriptions.'
    );
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('rejects invalid input without calling the AI model', async () => {
    await expect(
      generateProductDescription({ productName: '' })
    ).rejects.toThrow('Invalid product description request.');
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('rejects callers without products.create permission', async () => {
    mocks.ensurePermission.mockRejectedValue(
      new MerchantPermissionDeniedError('products', 'create')
    );

    await expect(
      generateProductDescription({ productName: 'Tote Bag' })
    ).rejects.toThrow(
      'You do not have permission to generate product descriptions.'
    );
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('rethrows unexpected permission-check errors instead of masking them', async () => {
    mocks.ensurePermission.mockRejectedValue(new Error('database outage'));

    await expect(
      generateProductDescription({ productName: 'Tote Bag' })
    ).rejects.toThrow('database outage');
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('returns the generated description on success', async () => {
    const result = await generateProductDescription({
      productName: 'Tote Bag',
      businessType: 'fashion',
    });

    expect(result).toEqual({ description: 'A lovely tote bag.' });
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
  });

  it('falls through to the next chain provider when the first one fails', async () => {
    mocks.generateText
      .mockRejectedValueOnce(new Error('429 rate limited'))
      .mockResolvedValueOnce({ text: 'A lovely tote bag.' });

    const result = await generateProductDescription({
      productName: 'Tote Bag',
    });

    expect(result).toEqual({ description: 'A lovely tote bag.' });
    expect(mocks.generateText).toHaveBeenCalledTimes(2);
  });

  it('wraps AI failures in a stable error message after exhausting every chain provider', async () => {
    mocks.generateText.mockRejectedValue(new Error('model unavailable'));

    await expect(
      generateProductDescription({ productName: 'Tote Bag' })
    ).rejects.toThrow('Failed to generate product description.');
    // Gemini-only chain in tests: both Gemini and Gemini-Lite are attempted
    // before the chain's exhaustion error reaches the flow's catch block.
    expect(mocks.generateText).toHaveBeenCalledTimes(2);
  });
});
