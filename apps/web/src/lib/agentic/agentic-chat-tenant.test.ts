import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAnonClient: vi.fn(),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

import { resolveAgenticChatTenant } from './agentic-chat-tenant';
import { resetAgenticMerchantIdCache } from './agentic-merchant-id';

const MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

function mockAnonMerchantLookup(result: {
  data: { id: string } | null;
  error?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: result.data,
    error: result.error ?? null,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  mocks.createAnonClient.mockReturnValue({ from });
  return { from, select, eq, maybeSingle };
}

describe('resolveAgenticChatTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
  });

  it('resolves the merchant id and slug from the configured slug', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    const { from, select, eq } = mockAnonMerchantLookup({
      data: { id: MERCHANT_ID },
    });

    // Act
    const tenant = await resolveAgenticChatTenant();

    // Assert
    expect(tenant).toEqual({
      merchantId: MERCHANT_ID,
      merchantSlug: 'ogabassey',
    });
    expect(from).toHaveBeenCalledWith('merchants');
    expect(select).toHaveBeenCalledWith('id');
    expect(eq).toHaveBeenCalledWith('slug', 'ogabassey');
  });

  describe('fails closed', () => {
    it('returns null without constructing an anon client when no slug is configured', async () => {
      // Arrange
      mockAnonMerchantLookup({ data: { id: MERCHANT_ID } });

      // Act
      const tenant = await resolveAgenticChatTenant();

      // Assert
      expect(tenant).toBeNull();
      // createAnonClient() throws on missing public env, so the slug check must
      // come first for the unconfigured path to stay fail-closed.
      expect(mocks.createAnonClient).not.toHaveBeenCalled();
    });

    it('returns null when the configured slug matches no merchant', async () => {
      // Arrange
      vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'does-not-exist');
      mockAnonMerchantLookup({ data: null });

      // Act
      const tenant = await resolveAgenticChatTenant();

      // Assert
      expect(tenant).toBeNull();
    });

    it('returns null instead of throwing when the anon client cannot be built', async () => {
      // Arrange
      vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
      mocks.createAnonClient.mockImplementation(() => {
        throw new Error('Public Supabase configuration is missing');
      });

      // Act
      const tenant = await resolveAgenticChatTenant();

      // Assert
      expect(tenant).toBeNull();
    });
  });
});
