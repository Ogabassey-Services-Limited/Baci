import { afterEach, describe, expect, it, vi } from 'vitest';

describe('shippingService', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('registers GIGL as an enabled shipping provider', async () => {
    const { shippingService } = await import('./index');

    expect(shippingService.getEnabledProviders()).toEqual(
      expect.arrayContaining(['GIGL', 'TOPSHIP'])
    );
  });

  it('throws when booking against an unavailable provider code', async () => {
    const { shippingService } = await import('./index');

    await expect(
      shippingService.bookShipment('MISSING' as never, {
        orderId: 'order-1',
        quoteId: 'quote-1',
        sender: {
          name: 'Merchant',
          phone: '+2348000000000',
          address: '1 Merchant Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
          countryCode: 'NG',
        },
        receiver: {
          name: 'Customer',
          phone: '+2348000000001',
          address: '1 Customer Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
          countryCode: 'NG',
        },
        items: [],
      })
    ).rejects.toThrow('Provider MISSING not found');
  });
});
