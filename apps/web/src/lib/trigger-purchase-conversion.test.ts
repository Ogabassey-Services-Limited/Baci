import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventPipelineTestClient } from '@/lib/events/event-pipeline-test-client';

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

const validItem = {
  name: 'iPhone 15',
  price: '200000',
  product_id: 'product-1',
  quantity: 1,
};

const validOrder: OrderForConversion = {
  currency: 'NGN',
  id: 'order-1',
  order_items: [validItem],
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
  return createEventPipelineTestClient(
    vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = new URL(String(input));
      const table = url.pathname.split('/').at(-1);
      if (table === 'merchant_feature_settings') {
        return Response.json(featureData);
      }
      const selected = url.searchParams.get('select') ?? '';
      if (selected.includes('payout_currency')) {
        return Response.json(merchantCurrencyData);
      }
      return error
        ? Response.json(error, { status: 500 })
        : Response.json(data);
    })
  );
}

describe('triggerPurchaseConversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EVENT_PIPELINE_ENQUEUE_ENABLED;
    mockSendPurchaseConversion.mockResolvedValue([
      { platform: 'facebook', success: true },
    ]);
  });

  it('sends a successful conversion for valid order items', async () => {
    await triggerPurchaseConversion(
      createSupabaseMock(),
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
        eventId: 'purchase_order-1',
        orderId: 'order-1',
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('omits malformed ad tracking fields from the conversion payload', async () => {
    await triggerPurchaseConversion(createSupabaseMock(), 'merchant-1', {
      ...validOrder,
      ad_tracking: {
        fbc: 42,
        fbclid: ['click-1'],
        limitedDataUse: 'true',
        userIp: { address: '203.0.113.10' },
      },
    });
    expect(mockSendPurchaseConversion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        fbc: undefined,
        fbclid: undefined,
        limitedDataUse: undefined,
        userIp: undefined,
      })
    );
  });

  it.each([
    ['uses the order currency as-is', 'GHS', null, 'GHS'],
    [
      'falls back to merchant currency',
      null,
      { country: 'GH', payout_currency: 'GHS' },
      'GHS',
    ],
    ['falls back to platform currency', undefined, null, 'NGN'],
  ])('%s', async (_name, currency, merchantCurrencyData, expectedCurrency) => {
    await triggerPurchaseConversion(
      createSupabaseMock({ merchantCurrencyData }),
      'merchant-1',
      { ...validOrder, currency }
    );
    expect(mockSendPurchaseConversion).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ currency: expectedCurrency })
    );
  });

  it('omits invalid order items and logs the skipped fields', async () => {
    await triggerPurchaseConversion(createSupabaseMock(), 'merchant-1', {
      currency: 'NGN',
      id: 'order-1',
      order_items: [
        validItem,
        {
          name: '',
          price: 'not-a-number',
          product_id: null,
          quantity: 0,
        },
      ],
      order_number: 'BAC-1',
      total: 200_000,
    });
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
    await triggerPurchaseConversion(createSupabaseMock(), 'merchant-1', {
      ...validOrder,
      order_items: [
        {
          name: 'Missing price',
          price: null,
          product_id: 'product-1',
          quantity: 1,
        },
      ],
    });
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
        createSupabaseMock(),
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

  it.each([
    { ...analyticsConfig, offline_conversions_enabled: false },
    {
      ...analyticsConfig,
      facebook_capi_token: 'locked-token',
      facebook_pixel_id: 'locked-pixel',
      plan_tier: 'free',
    },
  ])('does not send conversions for disabled config %#', async (data) => {
    await triggerPurchaseConversion(
      createSupabaseMock({ data }),
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
      createSupabaseMock({ error: { message: 'db failed' } }),
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
      triggerPurchaseConversion(createSupabaseMock(), 'merchant-1', validOrder)
    ).rejects.toThrow(error);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        message: 'Offline conversion tracking failed',
      })
    );
  });
});
