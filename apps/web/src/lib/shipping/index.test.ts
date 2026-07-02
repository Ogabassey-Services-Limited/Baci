import { afterEach, describe, expect, it, vi } from 'vitest';

async function importShippingService() {
  vi.resetModules();
  return await import('./index');
}

describe('shippingService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not register GIGL in production when runtime configuration is incomplete', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GIGL_BASE_URL', '');
    vi.stubEnv('GIGL_EMAIL', 'shipper@example.com');
    vi.stubEnv('GIGL_PASSWORD', 'secret');

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).not.toContain('GIGL');
    expect(shippingService.getEnabledProviders()).toContain('TOPSHIP');
  });

  it('registers GIGL in production when all runtime configuration is present', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GIGL_BASE_URL', 'https://thirdparty.example.test');
    vi.stubEnv('GIGL_EMAIL', 'shipper@example.com');
    vi.stubEnv('GIGL_PASSWORD', 'secret');

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).toEqual(
      expect.arrayContaining(['GIGL', 'TOPSHIP'])
    );
  });

  it('registers GIGL as an enabled shipping provider', async () => {
    vi.stubEnv('GIGL_BASE_URL', 'https://thirdparty.example.test');
    vi.stubEnv('GIGL_EMAIL', 'shipper@example.com');
    vi.stubEnv('GIGL_PASSWORD', 'secret');

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).toEqual(
      expect.arrayContaining(['GIGL', 'TOPSHIP'])
    );
  });

  it('does not register GIGL when the provider kill switch is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GIGL_ENABLED', 'false');
    vi.stubEnv('GIGL_BASE_URL', 'https://thirdpartynode.theagilitysystems.com');
    vi.stubEnv('GIGL_EMAIL', 'shipper@example.com');
    vi.stubEnv('GIGL_PASSWORD', 'secret');

    const { shippingService } = await importShippingService();

    expect(shippingService.getEnabledProviders()).not.toContain('GIGL');
    expect(shippingService.getEnabledProviders()).toContain('TOPSHIP');
  });

  it('throws when booking against an unavailable provider code', async () => {
    const { shippingService } = await importShippingService();

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
