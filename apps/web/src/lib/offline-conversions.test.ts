import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  facebookPurchase: vi.fn(),
  snapchatPurchase: vi.fn(),
  tiktokPurchase: vi.fn(),
}));

vi.mock('./facebook-capi', () => ({
  facebookCAPI: {
    purchase: (...args: unknown[]) => mocks.facebookPurchase(...args),
  },
}));
vi.mock('./ga4-measurement-protocol', () => ({
  ga4MeasurementProtocol: {},
  generateClientId: vi.fn(),
}));
vi.mock('./snapchat-capi', () => ({
  snapchatCAPI: {
    purchase: (...args: unknown[]) => mocks.snapchatPurchase(...args),
  },
}));
vi.mock('./tiktok-events-api', () => ({
  tiktokEventsAPI: {
    purchase: (...args: unknown[]) => mocks.tiktokPurchase(...args),
  },
}));

import { sendPurchaseConversion } from './offline-conversions';

describe('sendPurchaseConversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.facebookPurchase.mockResolvedValue({ success: true });
    mocks.snapchatPurchase.mockResolvedValue({ success: true });
    mocks.tiktokPurchase.mockResolvedValue({ success: true });
  });

  it('preserves stored click identity and Limited Data Use for Facebook', async () => {
    await sendPurchaseConversion(
      { facebook_capi_token: 'token', facebook_pixel_id: 'pixel' },
      {
        currency: 'NGN',
        fbc: 'fb.1.123.click',
        items: [{ id: 'sku-1', name: 'Phone', price: 100, quantity: 1 }],
        limitedDataUse: true,
        orderId: 'order-1',
        orderNumber: 'BAC-1',
        total: 100,
      }
    );

    expect(mocks.facebookPurchase).toHaveBeenCalledWith(
      'pixel',
      'token',
      expect.objectContaining({ fbc: 'fb.1.123.click' }),
      'BAC-1',
      100,
      'NGN',
      expect.any(Array),
      undefined,
      undefined,
      true
    );
  });

  it('skips Facebook when its credentials are incomplete', async () => {
    const results = await sendPurchaseConversion(
      { facebook_pixel_id: 'pixel' },
      {
        currency: 'NGN',
        items: [{ id: 'sku-1', name: 'Phone', price: 100, quantity: 1 }],
        orderId: 'order-1',
        orderNumber: 'BAC-1',
        total: 100,
      }
    );

    expect(results).toEqual([]);
    expect(mocks.facebookPurchase).not.toHaveBeenCalled();
  });

  it('falls back to fbclid when the stored fbc value is empty', async () => {
    await sendPurchaseConversion(
      { facebook_capi_token: 'token', facebook_pixel_id: 'pixel' },
      {
        currency: 'NGN',
        fbc: '',
        fbclid: 'click-1',
        items: [{ id: 'sku-1', name: 'Phone', price: 100, quantity: 1 }],
        orderId: 'order-1',
        orderNumber: 'BAC-1',
        total: 100,
      }
    );

    expect(mocks.facebookPurchase).toHaveBeenCalledWith(
      'pixel',
      'token',
      expect.objectContaining({
        fbc: expect.stringMatching(/^fb\.1\.\d+\.click-1$/),
      }),
      'BAC-1',
      100,
      'NGN',
      expect.any(Array),
      undefined,
      undefined,
      undefined
    );
  });

  it('passes the stable purchase event ID to legacy TikTok and Snapchat sends', async () => {
    await sendPurchaseConversion(
      {
        snapchat_capi_token: 'snap-token',
        snapchat_pixel_id: 'snap-pixel',
        tiktok_access_token: 'tiktok-token',
        tiktok_pixel_id: 'tiktok-pixel',
      },
      {
        currency: 'NGN',
        eventId: 'purchase_order-1',
        items: [{ id: 'sku-1', name: 'Phone', price: 100, quantity: 1 }],
        orderId: 'order-1',
        orderNumber: 'BAC-1',
        total: 100,
      }
    );

    expect(mocks.tiktokPurchase).toHaveBeenCalledWith(
      'tiktok-pixel',
      'tiktok-token',
      expect.any(Object),
      'BAC-1',
      100,
      'NGN',
      expect.any(Array),
      { eventId: 'purchase_order-1' }
    );
    expect(mocks.snapchatPurchase).toHaveBeenCalledWith(
      'snap-pixel',
      'snap-token',
      expect.any(Object),
      'BAC-1',
      100,
      'NGN',
      ['sku-1'],
      'purchase_order-1'
    );
  });
});
