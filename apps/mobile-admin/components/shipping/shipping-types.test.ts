import { describe, expect, it, vi } from 'vitest';
import {
  parseShippingSettings,
  shippingSettingsSchema,
} from './shipping-types';

describe('shipping-types', () => {
  it('parses valid shipping settings', () => {
    expect(
      parseShippingSettings({
        merchant_id: 'merchant-1',
        shipping_providers: ['gigl', 'topship'],
        free_shipping_threshold: 15000,
      })
    ).toEqual({
      merchant_id: 'merchant-1',
      shipping_providers: ['gigl', 'topship'],
      free_shipping_threshold: 15000,
    });
  });

  it('rejects invalid provider identifiers', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      // Silence expected schema validation noise in this test.
    });

    expect(() =>
      parseShippingSettings({
        merchant_id: 'merchant-1',
        shipping_providers: ['dhl'],
        free_shipping_threshold: null,
      })
    ).toThrow('Invalid shipping settings payload');

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('matches the expected runtime shipping settings shape', () => {
    expect(
      shippingSettingsSchema.safeParse({
        merchant_id: 'merchant-1',
        shipping_providers: ['shiip'],
        free_shipping_threshold: null,
      }).success
    ).toBe(true);
  });
});
