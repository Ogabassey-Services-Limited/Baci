import { describe, expect, it, vi } from 'vitest';
import { GiglDeliveryType, PickupOptions } from './gigl.constants';
import { fetchGiglQuote } from './gigl.fetch-quote';
import { quoteRequest } from './gigl.test-helpers';

describe('fetchGiglQuote', () => {
  it('returns no quote for a non-successful provider response', async () => {
    const log = vi.fn();
    const apiClient = {
      baseUrl: 'https://gigl.example',
      currentToken: null,
      safeFetchEnvelopeWithAccessToken: vi.fn().mockResolvedValue({
        envelope: null,
        response: new Response('unavailable', { status: 503 }),
      }),
    };
    const station = {
      StationId: 4,
      StationName: 'LAGOS',
      StationCode: undefined,
      State: undefined,
      StateName: 'LAGOS',
      City: undefined,
      Address: undefined,
      Latitude: undefined,
      Longitude: undefined,
    };

    await expect(
      fetchGiglQuote(
        apiClient as never,
        { log, generateQuoteId: vi.fn(), getQuoteExpiry: vi.fn() } as never,
        { token: 'token' } as never,
        quoteRequest,
        station,
        station,
        PickupOptions.HomeDelivery,
        GiglDeliveryType.GoStandard,
        1,
        new AbortController().signal
      )
    ).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(
      'warn',
      'GIGL quote request failed',
      expect.objectContaining({ status: 503 })
    );
  });
});
