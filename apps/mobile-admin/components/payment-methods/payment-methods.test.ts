import { describe, expect, it } from 'vitest';
import {
  buildPaymentMethods,
  getPaymentSettingsSelectColumns,
  parsePaymentSettings,
} from './payment-methods';

describe('mobile admin payment method definitions', () => {
  it('builds the admin list from registered provider definitions', () => {
    const methods = buildPaymentMethods([
      {
        category: 'gateway',
        description: 'A newly integrated payment provider',
        enabledField: 'new_gateway_enabled',
        id: 'new_gateway',
        name: 'New Gateway',
      },
    ]);

    expect(methods).toEqual([
      expect.objectContaining({
        category: 'gateway',
        dbField: 'new_gateway_enabled',
        icon: 'card-outline',
        id: 'new_gateway',
        name: 'New Gateway',
      }),
    ]);
  });

  it('builds the settings select columns from provider definitions', () => {
    const columns = getPaymentSettingsSelectColumns([
      {
        category: 'bnpl',
        description: 'A newly integrated BNPL provider',
        enabledField: 'new_bnpl_enabled',
        id: 'new_bnpl',
        name: 'New BNPL',
      },
    ]);

    expect(columns).toBe('id, merchant_id, new_bnpl_enabled');
  });

  it('validates dynamic payment settings rows before rendering', () => {
    expect(
      parsePaymentSettings(
        {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          new_bnpl_enabled: true,
        },
        [
          {
            category: 'bnpl',
            description: 'A newly integrated BNPL provider',
            enabledField: 'new_bnpl_enabled',
            id: 'new_bnpl',
            name: 'New BNPL',
          },
        ]
      )
    ).toEqual({
      id: 'settings-1',
      merchant_id: 'merchant-1',
      new_bnpl_enabled: true,
    });

    expect(() =>
      parsePaymentSettings(
        {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          new_bnpl_enabled: 'yes',
        },
        [
          {
            category: 'bnpl',
            description: 'A newly integrated BNPL provider',
            enabledField: 'new_bnpl_enabled',
            id: 'new_bnpl',
            name: 'New BNPL',
          },
        ]
      )
    ).toThrow('Invalid payment setting: new_bnpl_enabled');
  });
});
