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
});
