import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAnonClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

import { resetAgenticMerchantIdCache } from '@/lib/agentic/agentic-merchant-id';
import { logSantaInteraction } from './santa-interaction-log';

const MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

// The tenant lookup and the analytics insert share the same anon client, so the
// mock exposes both `from` (merchant lookup) and `rpc` (the definer insert).
function mockAnonClient(merchantId: string | null) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: merchantId ? { id: merchantId } : null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mocks.createAnonClient.mockReturnValue({
    from: vi.fn(() => ({ select })),
    rpc: mocks.rpc,
  });
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
    mocks.rpc.mockResolvedValue({ error: null });
    mockAnonClient(MERCHANT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
  });

  it('records the interaction via the definer RPC, not a service-role client', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');

    // Act
    await logSantaInteraction({
      ...baseParams,
      requestedPrice: 100,
      approvedPrice: 80,
    });

    // Assert: the privileged insert goes through log_santa_interaction (a
    // SECURITY DEFINER RPC) called on the RLS-scoped anon client.
    expect(mocks.rpc).toHaveBeenCalledWith(
      'log_santa_interaction',
      expect.objectContaining({
        p_merchant_id: MERCHANT_ID,
        p_session_id: 'session-1',
        p_interaction_type: 'wish_granted',
        p_discount_percentage: 20,
      })
    );
  });

  it('records no discount when the approved price is not below the requested price', async () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');

    await logSantaInteraction({
      ...baseParams,
      requestedPrice: 100,
      approvedPrice: 100,
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      'log_santa_interaction',
      expect.objectContaining({ p_discount_percentage: null })
    );
  });

  it('skips the insert entirely when the tenant is not configured', async () => {
    // Arrange: no BACI_AGENTIC_MERCHANT_SLUG
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    await logSantaInteraction(baseParams);

    // Assert: analytics rows must never be attributed to an unknown merchant.
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('logs the RPC error message without throwing when the insert is rejected by the DB', async () => {
    // Arrange: the RPC returns a Postgres error (e.g. invalid_merchant).
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    mocks.rpc.mockResolvedValueOnce({ error: { message: 'invalid_merchant' } });
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    // Act + Assert
    await expect(logSantaInteraction(baseParams)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      '[Santa Analytics] Failed to log interaction:',
      'invalid_merchant'
    );
  });

  it('swallows thrown errors so the chat response is never broken', async () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    mocks.rpc.mockRejectedValueOnce(new Error('rpc failed'));
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(logSantaInteraction(baseParams)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      '[Santa Analytics] Failed to log interaction:',
      expect.any(Error)
    );
  });
});
