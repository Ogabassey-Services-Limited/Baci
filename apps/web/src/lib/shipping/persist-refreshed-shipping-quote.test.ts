import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { persistRefreshedShippingQuote } from './persist-refreshed-shipping-quote';

describe('persistRefreshedShippingQuote', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses the trusted server writer for refreshed quote economics', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert }),
    });

    await expect(
      persistRefreshedShippingQuote(
        {
          id: 'q1',
          provider: 'GIGL',
          serviceTier: 'GoStandard',
          carrierName: 'GIG Logistics',
          displayName: 'GIG Logistics',
          estimatedDays: 2,
          price: 11_000,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: false,
          expiresAt: new Date('2026-01-01'),
          rawResponse: { secret: 'never persisted' },
        },
        {
          merchantId: 'm1',
          sessionId: 's1',
          quoteRequest: {} as never,
        }
      )
    ).resolves.toEqual({ error: null });

    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'q1',
        provider_metadata: null,
      }),
      { onConflict: 'id' }
    );
  });
});
