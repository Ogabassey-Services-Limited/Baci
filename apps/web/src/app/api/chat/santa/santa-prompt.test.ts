import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAnonClient: vi.fn(),
  getCachedSantaProducts: vi.fn(),
}));

vi.mock('@/ai/santa-data', () => ({
  getCachedSantaProducts: mocks.getCachedSantaProducts,
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

import { resetAgenticMerchantIdCache } from '@/lib/agentic/agentic-merchant-id';
import { generateSantaPrompt } from './santa-prompt';

const MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

function mockTenantLookup(merchantId: string | null) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: merchantId ? { id: merchantId } : null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mocks.createAnonClient.mockReturnValue({ from: vi.fn(() => ({ select })) });
}

describe('generateSantaPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
    mocks.getCachedSantaProducts.mockResolvedValue('- iPhone 16 Pro [FLEX]');
    mockTenantLookup(MERCHANT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
  });

  it('builds the catalogue prompt for the merchant resolved from the configured slug', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');

    // Act
    const prompt = await generateSantaPrompt();

    // Assert
    expect(mocks.getCachedSantaProducts).toHaveBeenCalledWith(MERCHANT_ID);
    expect(prompt).toContain('Santa Claus');
    expect(prompt).toContain('- iPhone 16 Pro [FLEX]');
  });

  it('falls back to the product-free prompt when the tenant is not configured', async () => {
    // Arrange: no BACI_AGENTIC_MERCHANT_SLUG
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    const prompt = await generateSantaPrompt();

    // Assert: no catalogue is fetched for an unknown tenant.
    expect(mocks.getCachedSantaProducts).not.toHaveBeenCalled();
    expect(prompt).toContain('Santa Claus');
    expect(prompt).not.toContain('Product Catalog');
  });

  it('falls back to the product-free prompt when the catalogue fetch throws', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    mocks.getCachedSantaProducts.mockRejectedValueOnce(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    const prompt = await generateSantaPrompt();

    // Assert
    expect(prompt).toContain('Santa Claus');
    expect(prompt).not.toContain('Product Catalog');
  });
});
