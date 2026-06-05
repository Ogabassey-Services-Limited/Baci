import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  fetchCheckoutShippingCities,
  fetchCheckoutShippingStates,
} from './checkout-shipping-requests';

describe('checkout-shipping-requests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps FCT city results when API and form state labels use different aliases', async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({
        locations: [
          { city: 'Garki', state: 'Abuja' },
          { city: 'Ikeja', state: 'Lagos' },
        ],
      }),
      ok: true,
    })) as unknown as typeof fetch;

    await expect(
      fetchCheckoutShippingCities(
        'https://example.com',
        'FCT - Abuja',
        new AbortController().signal
      )
    ).resolves.toEqual(['Garki']);
  });

  it('returns an empty list for aborted or failed city requests', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
    })) as unknown as typeof fetch;

    await expect(
      fetchCheckoutShippingCities(
        'https://example.com',
        'Lagos',
        new AbortController().signal
      )
    ).resolves.toEqual([]);
  });

  it('reuses warmed checkout state requests for the next checkout mount', async () => {
    global.fetch = jest.fn(async () => ({
      json: async () => ({ states: ['Lagos', 'FCT - Abuja'] }),
      ok: true,
    })) as unknown as typeof fetch;

    const first = fetchCheckoutShippingStates(
      'https://checkout-warmup.example'
    );
    const second = fetchCheckoutShippingStates(
      'https://checkout-warmup.example'
    );

    await expect(Promise.all([first, second])).resolves.toEqual([
      ['Lagos', 'FCT - Abuja'],
      ['Lagos', 'FCT - Abuja'],
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await expect(
      fetchCheckoutShippingStates('https://checkout-warmup.example')
    ).resolves.toEqual(['Lagos', 'FCT - Abuja']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
