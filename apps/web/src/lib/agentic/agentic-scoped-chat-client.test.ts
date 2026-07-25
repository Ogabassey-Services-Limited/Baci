import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgenticScopedSupabaseClient: vi.fn(),
  createAnonClient: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: mocks.createAgenticScopedSupabaseClient,
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

import { resetAgenticMerchantIdCache } from './agentic-merchant-id';
import { createAgenticScopedChatClient } from './agentic-scoped-chat-client';

const MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

function mockAnonMerchantLookup(id: string | null) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: id ? { id } : null, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mocks.createAnonClient.mockReturnValue({ from: vi.fn(() => ({ select })) });
}

describe('createAgenticScopedChatClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({ from: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
  });

  it('scopes the client to the resolved tenant without a session key when no session is supplied', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    mockAnonMerchantLookup(MERCHANT_ID);

    // Act
    const scoped = await createAgenticScopedChatClient();

    // Assert
    expect(scoped?.merchantId).toBe(MERCHANT_ID);
    expect(mocks.createAgenticScopedSupabaseClient).toHaveBeenCalledWith({
      merchantId: MERCHANT_ID,
      merchantSlug: 'ogabassey',
    });
    expect(
      Object.keys(mocks.createAgenticScopedSupabaseClient.mock.calls[0][0])
    ).not.toContain('sessionId');
  });

  it('includes the session id in the scope when one is supplied', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    mockAnonMerchantLookup(MERCHANT_ID);

    // Act
    await createAgenticScopedChatClient('session-1');

    // Assert
    expect(mocks.createAgenticScopedSupabaseClient).toHaveBeenCalledWith({
      merchantId: MERCHANT_ID,
      merchantSlug: 'ogabassey',
      sessionId: 'session-1',
    });
  });

  it('returns null and builds no scoped client when the tenant is unresolvable', async () => {
    // Arrange: no configured slug
    mockAnonMerchantLookup(MERCHANT_ID);

    // Act
    const scoped = await createAgenticScopedChatClient('session-1');

    // Assert
    expect(scoped).toBeNull();
    expect(mocks.createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
  });

  it('propagates scoped-client construction failures instead of reporting them as an unconfigured tenant', async () => {
    // Arrange
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    mockAnonMerchantLookup(MERCHANT_ID);
    mocks.createAgenticScopedSupabaseClient.mockImplementation(() => {
      throw new Error('boom');
    });

    // Act + Assert
    await expect(createAgenticScopedChatClient()).rejects.toThrow('boom');
  });
});
