import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAnonClient: vi.fn(),
  createServiceClient: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

import { resetAgenticMerchantIdCache } from '@/lib/agentic/agentic-merchant-id';
import { logSantaInteraction } from './santa-interaction-log';

const MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

function mockTenantLookup(merchantId: string | null) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: merchantId ? { id: merchantId } : null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mocks.createAnonClient.mockReturnValue({ from: vi.fn(() => ({ select })) });
}

const baseParams = {
  sessionId: 'session-1',
  clientIp: '127.0.0.1',
  interactionType: 'wish_granted' as const,
};

describe('logSantaInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({ insert: mocks.insert })),
    });
    mockTenantLookup(MERCHANT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
  });

  it('attributes the interaction to the merchant resolved from the configured slug', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');

    // Act
    await logSantaInteraction({
      ...baseParams,
      requestedPrice: 100,
      approvedPrice: 80,
    });

    // Assert
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: MERCHANT_ID,
        session_id: 'session-1',
        interaction_type: 'wish_granted',
        discount_percentage: 20,
      })
    );
  });

  it('records no discount when the approved price is not below the requested price', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');

    // Act
    await logSantaInteraction({
      ...baseParams,
      requestedPrice: 100,
      approvedPrice: 100,
    });

    // Assert
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ discount_percentage: null })
    );
  });

  it('skips the insert entirely when the tenant is not configured', async () => {
    // Arrange: no BACI_AGENTIC_MERCHANT_SLUG
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    await logSantaInteraction(baseParams);

    // Assert: analytics rows must never be attributed to an unknown merchant.
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('swallows insert failures so the chat response is never broken', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    mocks.insert.mockRejectedValueOnce(new Error('insert failed'));
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    // Act + Assert
    await expect(logSantaInteraction(baseParams)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      '[Santa Analytics] Failed to log interaction:',
      expect.any(Error)
    );
  });
});
