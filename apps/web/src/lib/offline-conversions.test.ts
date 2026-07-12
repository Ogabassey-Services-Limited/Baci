import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ facebookPurchase: vi.fn() }));

vi.mock('./facebook-capi', () => ({
  facebookCAPI: {
    purchase: (...args: unknown[]) => mocks.facebookPurchase(...args),
  },
}));
vi.mock('./ga4-measurement-protocol', () => ({
  ga4MeasurementProtocol: {},
  generateClientId: vi.fn(),
}));
vi.mock('./snapchat-capi', () => ({ snapchatCAPI: {} }));
vi.mock('./tiktok-events-api', () => ({ tiktokEventsAPI: {} }));

import { sendPurchaseConversion } from './offline-conversions';

describe('sendPurchaseConversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.facebookPurchase.mockResolvedValue({ success: true });
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
});
