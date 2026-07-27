import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MERCHANT_ID = '0b9f6b1a-3c2d-4e5f-8a7b-9c0d1e2f3a4b';
const OTHER_MERCHANT_ID = '9f8e7d6c-5b4a-4f3e-8d2c-1b0a9f8e7d6c';
const PRODUCT_ID = '1c8e5a2b-4d3c-4f6a-9b8c-0d1e2f3a4b5c';
const SECOND_PRODUCT_ID = '2c8e5a2b-4d3c-4f6a-9b8c-0d1e2f3a4b5c';

const mocks = vi.hoisted(() => ({
  ensurePermission: vi.fn(),
  from: vi.fn(),
  generateText: vi.fn(),
  getUser: vi.fn(),
  revalidateProductSlugs: vi.fn(),
  revalidateProducts: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('ai', () => ({ generateText: mocks.generateText }));
// generateTextWithChain builds its default chain via @/ai/text-provider-chain,
// which reads these exports from @/ai/provider — extend the partial mock with
// them (real chain/executor modules run unmocked, only their model source is
// stubbed) rather than stubbing the whole chain layer.
vi.mock('@/ai/provider', () => ({
  ACTIVE_TEXT_MODEL_NAME: 'gemini-2.5-flash',
  FALLBACK_TEXT_MODEL_NAME: 'gemini-2.5-flash-lite',
  activeTextModel: 'gemini-active-test-model',
  fallbackTextModel: 'gemini-fallback-test-model',
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock('@/lib/product-cache-revalidation', () => ({
  productCacheRevalidation: {
    revalidateProducts: (...args: unknown[]) =>
      mocks.revalidateProducts(...args),
    revalidateProductSlugs: (...args: unknown[]) =>
      mocks.revalidateProductSlugs(...args),
  },
}));

vi.mock('@/lib/merchant-server', () => {
  class MerchantAuthenticationRequiredError extends Error {
    constructor() {
      super('Authentication required');
      this.name = 'MerchantAuthenticationRequiredError';
    }
  }
  class MerchantPermissionDeniedError extends Error {
    constructor(resource: string, action: string) {
      super(`Permission denied: ${action} access to ${resource} is required`);
      this.name = 'MerchantPermissionDeniedError';
    }
  }
  return {
    MerchantAuthenticationRequiredError,
    MerchantPermissionDeniedError,
    ensurePermission: mocks.ensurePermission,
    isMerchantPermissionRedirectError: (error: unknown) =>
      error instanceof MerchantAuthenticationRequiredError ||
      error instanceof MerchantPermissionDeniedError,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

import { MerchantPermissionDeniedError } from '@/lib/merchant-server';
import {
  generateSEOSuggestions,
  getSEOStatus,
  saveSEOSettings,
} from './actions';

interface QueryBuilder {
  data: unknown;
  error: unknown;
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

// Awaiting a non-thenable resolves to the object itself, so the action's
// `const { data, error } = await query` destructures these properties.
function createQueryBuilder(result: {
  data?: unknown;
  error?: unknown;
}): QueryBuilder {
  const builder = {
    data: result.data ?? null,
    error: result.error ?? null,
  } as QueryBuilder;
  builder.select = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: builder.data, error: builder.error })
  );
  return builder;
}

const product = {
  id: PRODUCT_ID,
  name: 'Leather Tote Bag',
  description: 'A premium leather tote bag for everyday use.',
  meta_title: null,
  meta_description: null,
  keywords: [],
  category: 'Bags',
  brand: 'Baci',
  price: 25000,
};

const validOptimization = {
  productId: PRODUCT_ID,
  meta_title: 'Buy Premium Leather Tote Bags Online',
  meta_description:
    'Shop premium leather tote bags with fast delivery across Nigeria. Order today and enjoy durable, stylish quality you can trust every day.',
  keywords: ['leather tote', 'buy bags nigeria'],
};

function authenticate() {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
  mocks.ensurePermission.mockResolvedValue({
    merchant: { id: MERCHANT_ID },
    staffAccess: { isOwner: true },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReset();
  // Force the keyless (Gemini-only, 2-provider) chain so provider-count
  // assertions below are deterministic regardless of ambient env.
  vi.stubEnv('CEREBRAS_API_KEY', '');
  vi.stubEnv('GROQ_API_KEY', '');
  vi.stubEnv('OPENROUTER_API_KEY', '');
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getSEOStatus', () => {
  it('rejects unauthenticated callers without querying', async () => {
    await expect(getSEOStatus(MERCHANT_ID)).rejects.toThrow(
      'Authentication required'
    );
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects invalid merchant ids before checking permissions', async () => {
    authenticate();
    await expect(getSEOStatus('merchant-1')).rejects.toThrow(
      'Invalid merchant id'
    );
    expect(mocks.ensurePermission).not.toHaveBeenCalled();
  });

  it('propagates permission denials without querying', async () => {
    authenticate();
    mocks.ensurePermission.mockRejectedValue(
      new MerchantPermissionDeniedError('products', 'view')
    );

    await expect(getSEOStatus(MERCHANT_ID)).rejects.toThrow(
      'Permission denied'
    );
    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'view');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects merchant ids that do not match the session merchant', async () => {
    authenticate();
    await expect(getSEOStatus(OTHER_MERCHANT_ID)).rejects.toThrow(
      'Merchant mismatch'
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('returns analysis scoped to the session merchant on success', async () => {
    authenticate();
    const builder = createQueryBuilder({ data: [product] });
    mocks.from.mockReturnValue(builder);

    const result = await getSEOStatus(MERCHANT_ID);

    expect(builder.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(result.products).toHaveLength(1);
    expect(result.summary?.totalProducts).toBe(1);
  });
});

describe('generateSEOSuggestions', () => {
  it('rejects unauthenticated callers without calling the AI model', async () => {
    await expect(
      generateSEOSuggestions(MERCHANT_ID, [PRODUCT_ID])
    ).rejects.toThrow('Authentication required');
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('rejects batches larger than 20 products before querying', async () => {
    authenticate();
    await expect(
      generateSEOSuggestions(
        MERCHANT_ID,
        Array.from({ length: 21 }, () => PRODUCT_ID)
      )
    ).rejects.toThrow('Maximum 20 products per batch');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('propagates permission denials without calling the AI model', async () => {
    authenticate();
    mocks.ensurePermission.mockRejectedValue(
      new MerchantPermissionDeniedError('products', 'view')
    );

    await expect(
      generateSEOSuggestions(MERCHANT_ID, [PRODUCT_ID])
    ).rejects.toThrow('Permission denied');
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('generates optimizations scoped to the session merchant', async () => {
    authenticate();
    const builder = createQueryBuilder({ data: [product] });
    mocks.from.mockReturnValue(builder);
    mocks.generateText.mockResolvedValue({
      text: JSON.stringify({
        meta_title: validOptimization.meta_title,
        meta_description: validOptimization.meta_description,
        keywords: validOptimization.keywords,
        focus_keyword: 'leather tote',
        suggestions: [],
      }),
    });

    const result = await generateSEOSuggestions(MERCHANT_ID, [PRODUCT_ID]);

    expect(builder.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].optimized.meta_title).toBe(validOptimization.meta_title);
  });

  it('falls through to the fallback provider before returning a result', async () => {
    authenticate();
    const builder = createQueryBuilder({ data: [product] });
    mocks.from.mockReturnValue(builder);
    mocks.generateText
      .mockRejectedValueOnce(new Error('primary quota exceeded'))
      .mockResolvedValueOnce({
        text: JSON.stringify({
          meta_title: validOptimization.meta_title,
          meta_description: validOptimization.meta_description,
          keywords: validOptimization.keywords,
          focus_keyword: 'leather tote',
          suggestions: [],
        }),
      });

    const result = await generateSEOSuggestions(MERCHANT_ID, [PRODUCT_ID]);

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].optimized.meta_title).toBe(validOptimization.meta_title);
  });

  it('skips a product without throwing when its entire AI provider chain is exhausted', async () => {
    authenticate();
    const builder = createQueryBuilder({ data: [product] });
    mocks.from.mockReturnValue(builder);
    mocks.generateText.mockRejectedValue(new Error('quota exceeded'));

    const result = await generateSEOSuggestions(MERCHANT_ID, [PRODUCT_ID]);

    expect(result).toEqual([]);
    // Keyless env => 2-provider Gemini-only text chain; both attempted.
    expect(mocks.generateText).toHaveBeenCalledTimes(2);
  });
});

describe('saveSEOSettings', () => {
  it('returns an authentication failure without updating', async () => {
    const result = await saveSEOSettings(MERCHANT_ID, [validOptimization]);

    expect(result).toMatchObject({
      success: false,
      message: 'Authentication required',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('clamps overlong generated SEO fields before updating', async () => {
    authenticate();
    const builder = createQueryBuilder({ data: null });
    mocks.from.mockReturnValue(builder);

    const result = await saveSEOSettings(MERCHANT_ID, [
      {
        ...validOptimization,
        meta_title: 'a'.repeat(71),
        meta_description: 'b'.repeat(161),
      },
    ]);

    expect(result).toEqual({ success: true, updated: 1, failed: 0 });
    expect(builder.update).toHaveBeenCalledWith({
      meta_title: 'a'.repeat(70),
      meta_description: 'b'.repeat(160),
      keywords: validOptimization.keywords,
    });
  });

  it('returns a permission failure without updating when denied', async () => {
    authenticate();
    mocks.ensurePermission.mockRejectedValue(
      new MerchantPermissionDeniedError('products', 'edit')
    );

    const result = await saveSEOSettings(MERCHANT_ID, [validOptimization]);

    expect(mocks.ensurePermission).toHaveBeenCalledWith('products', 'edit');
    expect(result).toMatchObject({
      success: false,
      message: 'Permission denied',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects merchant ids that do not match the session merchant', async () => {
    authenticate();
    const result = await saveSEOSettings(OTHER_MERCHANT_ID, [
      validOptimization,
    ]);

    expect(result).toMatchObject({
      success: false,
      message: 'Merchant mismatch',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rethrows unexpected ensurePermission errors instead of masking them', async () => {
    authenticate();
    mocks.ensurePermission.mockRejectedValue(new Error('database outage'));

    await expect(
      saveSEOSettings(MERCHANT_ID, [validOptimization])
    ).rejects.toThrow('database outage');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('updates products scoped to the session merchant on success', async () => {
    authenticate();
    const builder = createQueryBuilder({ data: null });
    mocks.from.mockReturnValue(builder);

    const result = await saveSEOSettings(MERCHANT_ID, [validOptimization]);

    expect(builder.update).toHaveBeenCalledWith({
      meta_title: validOptimization.meta_title,
      meta_description: validOptimization.meta_description,
      keywords: validOptimization.keywords,
    });
    expect(builder.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/seo');
    expect(result).toEqual({ success: true, updated: 1, failed: 0 });
  });

  it('revalidates active products after successful SEO writes', async () => {
    authenticate();
    const updateBuilder = createQueryBuilder({ data: null });
    const publicProductsBuilder = createQueryBuilder({
      data: [
        {
          id: PRODUCT_ID,
          slug: 'leather-tote',
          name: product.name,
          category: 'Bags',
          categories: null,
          product_categories: [],
        },
      ],
    });
    const merchantBuilder = createQueryBuilder({
      data: { slug: 'test-store' },
    });
    mocks.from
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(publicProductsBuilder)
      .mockReturnValueOnce(merchantBuilder);

    const result = await saveSEOSettings(MERCHANT_ID, [validOptimization]);

    expect(result).toEqual({ success: true, updated: 1, failed: 0 });
    expect(mocks.revalidateProducts).toHaveBeenCalledWith(
      MERCHANT_ID,
      undefined,
      { feedScope: 'merchant' }
    );
    expect(mocks.revalidateProductSlugs).toHaveBeenCalledWith(MERCHANT_ID, [
      'leather-tote',
    ]);
  });

  it('revalidates only fulfilled active SEO writes when the batch partially fails', async () => {
    authenticate();
    const successfulUpdateBuilder = createQueryBuilder({ data: null });
    const failedUpdateBuilder = createQueryBuilder({
      error: { message: 'write failed' },
    });
    const publicProductsBuilder = createQueryBuilder({
      data: [
        {
          id: PRODUCT_ID,
          slug: 'leather-tote',
          name: product.name,
          category: 'Bags',
          categories: null,
          product_categories: [],
        },
      ],
    });
    const merchantBuilder = createQueryBuilder({
      data: { slug: 'test-store' },
    });
    mocks.from
      .mockReturnValueOnce(successfulUpdateBuilder)
      .mockReturnValueOnce(failedUpdateBuilder)
      .mockReturnValueOnce(publicProductsBuilder)
      .mockReturnValueOnce(merchantBuilder);

    const result = await saveSEOSettings(MERCHANT_ID, [
      validOptimization,
      { ...validOptimization, productId: SECOND_PRODUCT_ID },
    ]);

    expect(result).toEqual({
      success: true,
      updated: 1,
      failed: 1,
      message: 'Updated 1 products, 1 failed',
    });
    expect(mocks.revalidateProductSlugs).toHaveBeenCalledWith(MERCHANT_ID, [
      'leather-tote',
    ]);
    expect(publicProductsBuilder.in).toHaveBeenCalledWith('id', [PRODUCT_ID]);
  });
});
