import { describe, expect, it, vi } from 'vitest';
import {
  loadBoundAdminWalletGiglQuoteResponse,
  shouldReuseBoundAdminWalletGiglQuote,
} from './load-bound-admin-wallet-gigl-quote';

describe('shouldReuseBoundAdminWalletGiglQuote', () => {
  it('reuses a bound merchant-wallet GIGL quote outside preview', () => {
    expect(
      shouldReuseBoundAdminWalletGiglQuote(
        {
          selected_quote_id: 'quote-1',
          shipping_funding_source: 'merchant_wallet',
          shipping_provider: 'GIGL',
        },
        false
      )
    ).toBe('quote-1');
  });

  it('does not reuse preview requests or non-wallet orders', () => {
    expect(
      shouldReuseBoundAdminWalletGiglQuote(
        {
          selected_quote_id: 'quote-1',
          shipping_funding_source: 'merchant_wallet',
          shipping_provider: 'GIGL',
        },
        true
      )
    ).toBeNull();
    expect(
      shouldReuseBoundAdminWalletGiglQuote(
        {
          selected_quote_id: 'quote-1',
          shipping_funding_source: 'customer_checkout',
          shipping_provider: 'GIGL',
        },
        false
      )
    ).toBeNull();
  });
});

describe('loadBoundAdminWalletGiglQuoteResponse', () => {
  it('skips reuse when the latest charge for the bound quote was refunded', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: 'quote-1',
          provider: 'GIGL',
          service_tier: 'Express',
          carrier_name: 'GIG Logistics',
          price: 2500,
          currency: 'NGN',
          estimated_days: 1,
          expires_at: '2026-09-04T12:00:00.000Z',
          provider_rate_id: 'rate-1',
          is_station_pickup: false,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { status: 'refunded' },
        error: null,
      });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ eq, order, maybeSingle }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({ eq })),
    }));
    const supabase = {
      from,
      rpc: vi.fn(),
    } as unknown as Parameters<typeof loadBoundAdminWalletGiglQuoteResponse>[0];

    await expect(
      loadBoundAdminWalletGiglQuoteResponse(supabase, 'merchant-1', 'quote-1')
    ).resolves.toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('skips reuse when the bound quote is expired and has no active charge', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: 'quote-1',
          provider: 'GIGL',
          service_tier: 'Express',
          carrier_name: 'GIG Logistics',
          price: 2500,
          currency: 'NGN',
          estimated_days: 1,
          expires_at: '2020-01-01T00:00:00.000Z',
          provider_rate_id: 'rate-1',
          is_station_pickup: false,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { status: 'completed' },
        error: null,
      });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ eq, order, maybeSingle }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({ eq })),
    }));
    const supabase = {
      from,
      rpc: vi.fn(),
    } as unknown as Parameters<typeof loadBoundAdminWalletGiglQuoteResponse>[0];

    await expect(
      loadBoundAdminWalletGiglQuoteResponse(supabase, 'merchant-1', 'quote-1')
    ).resolves.toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('reuses an expired bound quote when a reserved charge is still active', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: 'quote-1',
          provider: 'GIGL',
          service_tier: 'Express',
          carrier_name: 'GIG Logistics',
          price: 2500,
          currency: 'NGN',
          estimated_days: 1,
          expires_at: '2020-01-01T00:00:00.000Z',
          provider_rate_id: 'rate-1',
          is_station_pickup: false,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { status: 'reserved' },
        error: null,
      });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ eq, order, maybeSingle }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({ eq })),
    }));
    const supabase = {
      from,
      rpc: vi.fn().mockResolvedValue({
        data: [{ available_balance: 10_000 }],
        error: null,
      }),
    } as unknown as Parameters<typeof loadBoundAdminWalletGiglQuoteResponse>[0];

    const response = await loadBoundAdminWalletGiglQuoteResponse(
      supabase,
      'merchant-1',
      'quote-1'
    );

    expect(response).not.toBeNull();
    await expect(response?.json()).resolves.toMatchObject({
      quote: { id: 'quote-1', provider: 'GIGL' },
      canBook: true,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('get_wallet_summary', {
      p_merchant_id: 'merchant-1',
    });
  });
});
