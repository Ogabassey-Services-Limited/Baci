import { describe, expect, it, vi } from 'vitest';
import {
  getMerchantShippingRates,
  getMerchantShippingRatesOrThrow,
  MerchantShippingRatesLoadError,
} from './get-merchant-shipping-rates';

const RATES_RPC_PAYLOAD = {
  zones: [{ id: 'z1', name: 'Lagos', is_rest_of_world: false }],
  locations: [{ zone_id: 'z1', country_code: 'NG', subdivision_code: 'NG-LA' }],
  rates: [
    {
      id: 'r1',
      zone_id: 'z1',
      name: 'Standard',
      kind: 'ship',
      currency: 'NGN',
      base_amount: 1500,
      condition_type: 'always',
      min_subtotal: null,
      max_subtotal: null,
      free_over_amount: null,
      delivery_min_days: 1,
      delivery_max_days: 3,
      pickup_address: null,
      sort_order: 0,
    },
  ],
};

function clientWith(result: { data?: unknown; error?: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...result }),
  } as never;
}

describe('getMerchantShippingRates', () => {
  it('calls the storefront RPC and returns the parsed payload', async () => {
    // Arrange
    const supabase = clientWith({
      data: {
        zones: [{ id: 'z1', name: 'Lagos', is_rest_of_world: false }],
        locations: [
          { zone_id: 'z1', country_code: 'NG', subdivision_code: 'NG-LA' },
        ],
        rates: [
          {
            id: 'r1',
            zone_id: 'z1',
            name: 'Standard',
            kind: 'ship',
            currency: 'NGN',
            base_amount: 1500,
            condition_type: 'always',
            min_subtotal: null,
            max_subtotal: null,
            free_over_amount: null,
            delivery_min_days: 1,
            delivery_max_days: 3,
            pickup_address: null,
            sort_order: 0,
          },
        ],
      },
    });

    // Act
    const payload = await getMerchantShippingRates(supabase, 'merchant-1');

    // Assert
    expect(
      (supabase as { rpc: ReturnType<typeof vi.fn> }).rpc
    ).toHaveBeenCalledWith('get_storefront_shipping_rates', {
      p_merchant_id: 'merchant-1',
    });
    expect(payload.zones).toHaveLength(1);
    expect(payload.rates[0]?.currency).toBe('NGN');
  });

  it('surfaces merchant payout currency and country from the RPC payload', async () => {
    // Arrange — the RPC now returns the merchant's canonical currency inputs.
    const supabase = clientWith({
      data: {
        zones: [{ id: 'z1', name: 'Mumbai', is_rest_of_world: false }],
        locations: [
          { zone_id: 'z1', country_code: 'IN', subdivision_code: null },
        ],
        rates: [
          {
            id: 'r1',
            zone_id: 'z1',
            name: 'Standard',
            kind: 'ship',
            currency: 'INR',
            base_amount: 200,
            condition_type: 'always',
            min_subtotal: null,
            max_subtotal: null,
            free_over_amount: null,
            delivery_min_days: 1,
            delivery_max_days: 3,
            pickup_address: null,
            sort_order: 0,
          },
        ],
        merchant_payout_currency: 'INR',
        merchant_country: 'IN',
      },
    });

    // Act
    const payload = await getMerchantShippingRates(supabase, 'merchant-1');

    // Assert
    expect(payload.merchantPayoutCurrency).toBe('INR');
    expect(payload.merchantCountry).toBe('IN');
  });

  it('fails soft to empty payload on RPC error', async () => {
    // Arrange
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const supabase = clientWith({ error: new Error('rpc down') });

    // Act
    const payload = await getMerchantShippingRates(supabase, 'merchant-1');

    // Assert
    expect(payload).toEqual({
      zones: [],
      locations: [],
      rates: [],
      shippingProviders: [],
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('fails soft to empty payload on malformed data', async () => {
    // Arrange
    const supabase = clientWith({ data: { nonsense: true } });

    // Act
    const payload = await getMerchantShippingRates(supabase, 'merchant-1');

    // Assert
    expect(payload).toEqual({
      zones: [],
      locations: [],
      rates: [],
      shippingProviders: [],
    });
  });
});

describe('getMerchantShippingRatesOrThrow', () => {
  it('returns the parsed payload on a successful RPC', async () => {
    // Arrange
    const supabase = clientWith({ data: RATES_RPC_PAYLOAD });

    // Act
    const payload = await getMerchantShippingRatesOrThrow(
      supabase,
      'merchant-1'
    );

    // Assert
    expect(
      (supabase as { rpc: ReturnType<typeof vi.fn> }).rpc
    ).toHaveBeenCalledWith('get_storefront_shipping_rates', {
      p_merchant_id: 'merchant-1',
    });
    expect(payload.zones).toHaveLength(1);
    expect(payload.rates[0]?.currency).toBe('NGN');
  });

  it('throws MerchantShippingRatesLoadError on RPC error instead of failing soft', async () => {
    // Arrange
    const supabase = clientWith({
      error: { message: 'schema cache reload', code: 'PGRST002' },
    });

    // Act + Assert
    await expect(
      getMerchantShippingRatesOrThrow(supabase, 'merchant-1')
    ).rejects.toBeInstanceOf(MerchantShippingRatesLoadError);
  });

  it('surfaces the RPC error code on the thrown load error', async () => {
    // Arrange
    const supabase = clientWith({
      error: { message: 'db unavailable', code: '57P01' },
    });

    // Act
    const loadError = await getMerchantShippingRatesOrThrow(
      supabase,
      'merchant-1'
    ).catch((error: unknown) => error);

    // Assert
    expect(loadError).toBeInstanceOf(MerchantShippingRatesLoadError);
    expect((loadError as MerchantShippingRatesLoadError).code).toBe('57P01');
  });

  it('does NOT throw on a successful-but-malformed payload (parses to empty)', async () => {
    // Arrange — a load that SUCCEEDED (no RPC error) but returned junk is a
    // genuinely-empty result to the verifier, not a load failure.
    const supabase = clientWith({ data: { nonsense: true } });

    // Act
    const payload = await getMerchantShippingRatesOrThrow(
      supabase,
      'merchant-1'
    );

    // Assert
    expect(payload).toEqual({
      zones: [],
      locations: [],
      rates: [],
      shippingProviders: [],
    });
  });
});
