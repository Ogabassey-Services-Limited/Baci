import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiPost: mockApiPost,
}));

import { requestShippingOptions } from './shipping-options-quote-request';

describe('requestShippingOptions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockApiPost.mockReset();
  });

  it('uses the web storefront marker while posting the domestic quote request', async () => {
    mockApiPost.mockResolvedValue({ ok: true });

    await expect(
      requestShippingOptions({
        merchantId: 'merchant-1',
        receiverCity: 'Lagos',
        receiverState: 'Lagos',
        receiverAddress: '1 Marina Road',
        receiverPhone: '08000000000',
        receiverName: 'Ada',
        quoteItems: [{ name: 'Phone', quantity: 1, weight: 1, value: 5000 }],
      })
    ).resolves.toEqual({ ok: true });

    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/shipping/quotes',
      expect.objectContaining({
        merchantId: 'merchant-1',
        shipmentType: 'domestic',
      }),
      { headers: { 'x-baci-client': 'web-storefront' } }
    );
  });
});
