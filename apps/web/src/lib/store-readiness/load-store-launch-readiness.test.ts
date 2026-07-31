import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { loadStoreLaunchReadiness } from './load-store-launch-readiness';

vi.mock('server-only', () => ({}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

function query(result: QueryResult) {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => builder),
  };

  // Supabase query builders are intentionally thenable so awaited count queries resolve.
  Object.defineProperty(builder, 'then', {
    value: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  });

  return builder;
}

function client(
  options: {
    merchantError?: { message: string } | null;
    paymentError?: { message: string } | null;
    activeProductError?: { message: string } | null;
    totalProductError?: { message: string } | null;
    paystackError?: { message: string } | null;
    identityError?: { message: string } | null;
    country?: string;
    korapayEnabled?: boolean;
    payoutCurrency?: string;
    activeProductCount?: number;
    totalProductCount?: number;
    paystackEnabled?: boolean;
    payOnDeliveryEnabled?: boolean | null;
  } = {}
) {
  const merchants = query({
    data: {
      bank_account_number: '0001112223',
      bank_code: '044',
      country: options.country ?? 'NG',
      email: 'owner@example.com',
      payout_currency: options.payoutCurrency ?? 'NGN',
      phone: null,
      slug: 'merchant-one',
      support_email: null,
      support_phone: null,
    },
    error: options.merchantError ?? null,
  });
  const settings = query({
    data: {
      korapay_enabled: options.korapayEnabled ?? false,
      pay_on_delivery_enabled:
        options.payOnDeliveryEnabled === undefined
          ? false
          : options.payOnDeliveryEnabled,
      paystack_enabled: options.paystackEnabled ?? true,
    },
    error: options.paymentError ?? null,
  });
  const activeProducts = query({
    count: options.activeProductCount ?? 1,
    data: null,
    error: options.activeProductError ?? null,
  });
  const totalProducts = query({
    count: options.totalProductCount ?? 3,
    data: null,
    error: options.totalProductError ?? null,
  });
  const productQueries = [activeProducts, totalProducts];
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'merchants') return merchants;
      if (table === 'merchant_feature_settings') return settings;
      if (table === 'products') {
        const next = productQueries.shift();
        if (!next) throw new Error('Unexpected product query');
        return next;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn((name: string) => {
      if (name === 'get_merchant_paystack_subaccount_configured') {
        return Promise.resolve({
          data: true,
          error: options.paystackError ?? null,
        });
      }
      if (name === 'get_merchant_identity_verified') {
        return Promise.resolve({
          data: true,
          error: options.identityError ?? null,
        });
      }
      throw new Error(`Unexpected RPC: ${name}`);
    }),
  } as unknown as SupabaseClient;

  return { activeProducts, merchants, settings, supabase, totalProducts };
}

describe('loadStoreLaunchReadiness', () => {
  it('loads canonical launch facts through the authenticated client without a payment secret', async () => {
    const authenticatedClient = client();

    const result = await loadStoreLaunchReadiness({
      supabase: authenticatedClient.supabase,
      merchantId: 'merchant-1',
    });

    expect(authenticatedClient.supabase.from).toHaveBeenCalledWith('merchants');
    expect(authenticatedClient.supabase.rpc).toHaveBeenCalledWith(
      'get_merchant_identity_verified',
      { p_merchant_id: 'merchant-1' }
    );
    expect(authenticatedClient.supabase.rpc).toHaveBeenCalledWith(
      'get_merchant_paystack_subaccount_configured',
      { p_merchant_id: 'merchant-1' }
    );
    expect(authenticatedClient.merchants.eq).toHaveBeenCalledWith(
      'id',
      'merchant-1'
    );
    expect(authenticatedClient.merchants.select).toHaveBeenCalledWith(
      expect.not.stringContaining('paystack_subaccount_code')
    );
    expect(authenticatedClient.settings.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(authenticatedClient.activeProducts.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(authenticatedClient.totalProducts.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'bank_account', completed: true })
    );
    expect(result.activeProductCount).toBe(1);
    expect(result.totalProductCount).toBe(3);
  });

  it('does not fail non-Nigerian readiness when the irrelevant identity RPC is unavailable', async () => {
    const authenticatedClient = client({
      country: 'GH',
      identityError: { message: 'identity unavailable' },
    });

    const result = await loadStoreLaunchReadiness({
      supabase: authenticatedClient.supabase,
      merchantId: 'merchant-1',
    });

    expect(result.items).toContainEqual(
      expect.objectContaining({
        id: 'verify_kyc',
        completed: true,
        priority: 'recommended',
      })
    );
    expect(authenticatedClient.supabase.rpc).not.toHaveBeenCalledWith(
      'get_merchant_identity_verified',
      { p_merchant_id: 'merchant-1' }
    );
  });

  it('classifies a disabled Nigerian Paystack gateway as an incomplete payment-method task', async () => {
    const authenticatedClient = client({ paystackEnabled: false });

    const result = await loadStoreLaunchReadiness({
      supabase: authenticatedClient.supabase,
      merchantId: 'merchant-1',
    });

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'payment_method', completed: false })
    );
    expect(result.items).not.toContainEqual(
      expect.objectContaining({ id: 'bank_account', completed: false })
    );
  });

  it('treats a missing Pay on Delivery flag as unavailable when Paystack is disabled', async () => {
    const authenticatedClient = client({
      paystackEnabled: false,
      payOnDeliveryEnabled: null,
    });

    const result = await loadStoreLaunchReadiness({
      supabase: authenticatedClient.supabase,
      merchantId: 'merchant-1',
    });

    expect(result.items).toContainEqual(
      expect.objectContaining({ id: 'payment_method', completed: false })
    );
  });

  it('treats enabled Korapay as a completed payment method only in a supported payout currency', async () => {
    const supportedClient = client({
      country: 'GH',
      korapayEnabled: true,
      paystackEnabled: false,
      payoutCurrency: 'GHS',
    });
    const unsupportedClient = client({
      country: 'IN',
      korapayEnabled: true,
      paystackEnabled: false,
      payoutCurrency: 'INR',
    });

    await expect(
      loadStoreLaunchReadiness({
        supabase: supportedClient.supabase,
        merchantId: 'merchant-1',
      })
    ).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'payment_method', completed: true }),
      ]),
    });
    await expect(
      loadStoreLaunchReadiness({
        supabase: unsupportedClient.supabase,
        merchantId: 'merchant-1',
      })
    ).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'payment_method', completed: false }),
      ]),
    });
  });

  it.each([
    ['merchant', { merchantError: { message: 'merchant unavailable' } }],
    ['payment settings', { paymentError: { message: 'settings unavailable' } }],
    [
      'active product count',
      { activeProductError: { message: 'products unavailable' } },
    ],
    [
      'total product count',
      { totalProductError: { message: 'products unavailable' } },
    ],
    [
      'Paystack configured RPC',
      { paystackError: { message: 'paystack unavailable' } },
    ],
    [
      'identity verification RPC',
      { identityError: { message: 'identity unavailable' } },
    ],
  ])('rejects rather than turning a %s failure into incomplete readiness', async (_name, options) => {
    await expect(
      loadStoreLaunchReadiness({
        supabase: client(options).supabase,
        merchantId: 'merchant-1',
      })
    ).rejects.toThrow();
  });
});
