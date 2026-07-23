import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  generateObject: vi.fn(),
  getUser: vi.fn(),
}));

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
  sanitizePromptInput: (input: string, maxLength: number) => ({
    value: input.slice(0, maxLength),
    metadata: {
      wasTruncated: input.length > maxLength,
      originalLength: input.length,
      finalLength: Math.min(input.length, maxLength),
      limit: maxLength,
    },
  }),
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}));

vi.mock('@/lib/category-configs', () => ({
  getCategoryConfigFromBusinessType: () => ({
    variantAttributes: [
      { label: 'Color', options: ['Black', 'Blue', 'Silver'] },
    ],
    productCategories: ['Phones', 'Laptops'],
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: mocks.ensurePermission,
  isMerchantPermissionRedirectError: (error: unknown) =>
    error instanceof Error && error.name === 'MerchantPermissionDeniedError',
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

import { autofillProductDetails } from './autofill-product-details';

const validInput = {
  productName: 'samsung s24',
  businessType: 'electronics',
};

const generatedDetails = {
  suggestedName: 'Samsung Galaxy S24',
  description: 'A flagship phone.',
  category: 'Phones',
  brand: 'Samsung',
  suggestedVariants: [],
};

describe('autofillProductDetails', () => {
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
    mocks.generateObject.mockResolvedValue({ object: generatedDetails });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws a sign-in error and skips generation when unauthenticated', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(autofillProductDetails(validInput)).rejects.toThrow(
      'You must be signed in to autofill product details.'
    );
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('throws an invalid-input error and skips generation for bad input', async () => {
    await expect(
      autofillProductDetails({ productName: '', businessType: 'electronics' })
    ).rejects.toThrow('Invalid product autofill input.');
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('throws a permission error and skips generation when product create access is denied', async () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'MerchantPermissionDeniedError';
    mocks.ensurePermission.mockRejectedValue(permissionError);

    await expect(autofillProductDetails(validInput)).rejects.toThrow(
      'You do not have permission to autofill product details.'
    );
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('rethrows unexpected permission-check failures instead of swallowing them', async () => {
    mocks.ensurePermission.mockRejectedValue(new Error('database is down'));

    await expect(autofillProductDetails(validInput)).rejects.toThrow(
      'database is down'
    );
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it('returns generated details with truncation metadata on the happy path', async () => {
    const result = await autofillProductDetails(validInput);

    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mocks.generateObject).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      details: generatedDetails,
      metadata: {
        inputTruncation: {
          productName: false,
          businessType: false,
        },
      },
    });
  });

  it('flags truncated inputs in the response metadata', async () => {
    const result = await autofillProductDetails({
      productName: 'a'.repeat(300),
      businessType: 'electronics',
    });

    expect(result.metadata?.inputTruncation?.productName).toBe(true);
    expect(result.metadata?.inputTruncation?.businessType).toBe(false);
  });

  it('falls through to the next chain provider when the first one fails', async () => {
    mocks.generateObject
      .mockRejectedValueOnce(new Error('429 rate limited'))
      .mockResolvedValueOnce({ object: generatedDetails });

    const result = await autofillProductDetails(validInput);

    expect(mocks.generateObject).toHaveBeenCalledTimes(2);
    expect(result.details).toEqual(generatedDetails);
  });

  it('wraps chain exhaustion in a stable error after every provider fails', async () => {
    mocks.generateObject.mockRejectedValue(new Error('model unavailable'));

    await expect(autofillProductDetails(validInput)).rejects.toThrow(
      'Failed to generate product details.'
    );
    // Gemini-only chain in tests: both Gemini and Gemini-Lite are attempted
    // before the chain's exhaustion error reaches the flow's catch block.
    expect(mocks.generateObject).toHaveBeenCalledTimes(2);
  });

  it('wraps chain exhaustion in a stable error when every provider returns off-shape JSON', async () => {
    mocks.generateObject.mockResolvedValue({
      object: { suggestedName: '', description: '' }, // missing required fields
    });

    await expect(autofillProductDetails(validInput)).rejects.toThrow(
      'Failed to generate product details.'
    );
  });
});
