import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendPurchaseConversion = vi.fn();
const mockLogConversionResults = vi.fn();

vi.mock('@/lib/offline-conversions', () => ({
  logConversionResults: (...args: unknown[]) =>
    mockLogConversionResults(...args),
  sendPurchaseConversion: (...args: unknown[]) =>
    mockSendPurchaseConversion(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';
import {
  type OrderForConversion,
  triggerPurchaseConversion,
} from '@/lib/trigger-purchase-conversion';

const analyticsConfig = {
  facebook_capi_token: 'token',
  facebook_pixel_id: 'pixel',
  ga4_api_secret: null,
  google_analytics_id: null,
  offline_conversions_enabled: true,
  plan_expires_at: null,
  plan_tier: 'pro',
  premium_features: [],
  snapchat_capi_token: null,
  snapchat_pixel_id: null,
  tiktok_access_token: null,
  tiktok_pixel_id: null,
};

const validOrder: OrderForConversion = {
  currency: 'NGN',
  id: 'order-1',
  order_items: [
    {
      name: 'iPhone 15',
      price: '200000',
      product_id: 'product-1',
      quantity: 1,
    },
  ],
  order_number: 'BAC-1',
  total: 200_000,
};

function createSupabaseMock({
  data = analyticsConfig,
  error = null,
  featureData = null,
  merchantCurrencyData = null,
}: {
  data?: unknown;
  error?: unknown;
  featureData?: unknown;
  merchantCurrencyData?: {
    country?: string | null;
    payout_currency?: string | null;
  } | null;
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'merchant_feature_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({ data: featureData, error: null })),
        };
      }

      // Both the analytics config lookup and the currency fallback lookup
      // query the `merchants` table; disambiguate by requested columns.
      return {
        select: vi.fn((columns: string) => {
          const isCurrencyLookup = columns.includes('payout_currency');
          return {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(async () =>
              isCurrencyLookup
                ? { data: merchantCurrencyData, error: null }
                : { data, error }
            ),
          };
        }),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({ data, error })),
      };
    }),
  };
}

describe('triggerPurchaseConversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPurchaseConversion.mockResolvedValue([
      { platform: 'facebook', success: true },
    ]);
  });

  it('sends a successful conversion for valid order items', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock() as never,
      'merchant-1',
      validOrder
    );

    expect(mockSendPurchaseConversion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        items: [
          {
            id: 'product-1',
            name: 'iPhone 15',
            price: 200_000,
            quantity: 1,
          },
        ],
        orderId: 'order-1',
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('uses the order currency as-is when present', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock() as never,
      'merchant-1',
      { ...validOrder, currency: 'GHS' }
    );

    expect(mockSendPurchaseConversion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ currency: 'GHS' })
    );
  });

  it('falls back to the merchant-resolved currency when the order has none', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock({
        merchantCurrencyData: { country: 'GH', payout_currency: 'GHS' },
      }) as never,
      'merchant-1',
      { ...validOrder, currency: null }
    );

    expect(mockSendPurchaseConversion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ currency: 'GHS' })
    );
  });

  it('falls back to the platform default currency when the order and merchant lookup have none', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock({ merchantCurrencyData: null }) as never,
      'merchant-1',
      { ...validOrder, currency: undefined }
    );

    expect(mockSendPurchaseConversion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ currency: 'NGN' })
    );
  });

  it('omits invalid order items and logs the skipped fields', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock() as never,
      'merchant-1',
      {
        currency: 'NGN',
        id: 'order-1',
        order_items: [
          {
            name: 'iPhone 15',
            price: '200000',
            product_id: 'product-1',
            quantity: 1,
          },
          {
            name: '',
            price: 'not-a-number',
            product_id: null,
            quantity: 0,
          },
        ],
        order_number: 'BAC-1',
        total: 200_000,
      }
    );

    expect(mockSendPurchaseConversion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        items: [
          {
            id: 'product-1',
            name: 'iPhone 15',
            price: 200_000,
            quantity: 1,
          },
        ],
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        invalidFields: ['product_id', 'name', 'price', 'quantity'],
        itemIndex: 1,
        message: 'Skipping invalid order item for conversion tracking',
        orderId: 'order-1',
      })
    );
  });

  it('treats null money values as invalid order item data', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock() as never,
      'merchant-1',
      {
        ...validOrder,
        order_items: [
          {
            name: 'Missing price',
            price: null,
            product_id: 'product-1',
            quantity: 1,
          },
        ],
      }
    );

    expect(mockSendPurchaseConversion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ items: [] })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        invalidFields: ['price'],
        message: 'Skipping invalid order item for conversion tracking',
      })
    );
  });

  it('throws on invalid order items when strict validation is enabled', async () => {
    await expect(
      triggerPurchaseConversion(
        createSupabaseMock() as never,
        'merchant-1',
        {
          ...validOrder,
          order_items: [{ name: '', price: -1, product_id: null, quantity: 0 }],
        },
        { failOnInvalidItem: true }
      )
    ).rejects.toThrow('Invalid order item for conversion tracking');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        invalidFields: ['product_id', 'name', 'price', 'quantity'],
        message: 'Invalid order item for conversion tracking',
      })
    );
    expect(mockSendPurchaseConversion).not.toHaveBeenCalled();
  });

  it('does not send conversions when offline conversions are disabled', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock({
        data: { ...analyticsConfig, offline_conversions_enabled: false },
      }) as never,
      'merchant-1',
      validOrder
    );

    expect(mockSendPurchaseConversion).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Offline conversions disabled by merchant',
      })
    );
  });

  it('does not send conversions when growth integrations are locked', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock({
        data: {
          ...analyticsConfig,
          plan_tier: 'free',
          facebook_capi_token: 'locked-token',
          facebook_pixel_id: 'locked-pixel',
        },
      }) as never,
      'merchant-1',
      validOrder
    );

    expect(mockSendPurchaseConversion).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Offline conversions disabled by merchant',
      })
    );
  });

  it('logs and returns when analytics configuration cannot be loaded', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock({ error: { message: 'db failed' } }) as never,
      'merchant-1',
      validOrder
    );

    expect(mockSendPurchaseConversion).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to fetch analytics config for conversion tracking',
      })
    );
  });

  it('logs and rethrows conversion sender failures', async () => {
    const error = new Error('capi failed');
    mockSendPurchaseConversion.mockRejectedValueOnce(error);

    await expect(
      triggerPurchaseConversion(
        createSupabaseMock() as never,
        'merchant-1',
        validOrder
      )
    ).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        message: 'Offline conversion tracking failed',
      })
    );
  });
});
