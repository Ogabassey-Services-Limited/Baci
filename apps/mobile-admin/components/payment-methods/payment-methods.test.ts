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

  it('returns no admin methods when no provider definitions are registered', () => {
    expect(buildPaymentMethods([])).toEqual([]);
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

  it('returns only base settings columns when no provider definitions are registered', () => {
    expect(getPaymentSettingsSelectColumns([])).toBe('id, merchant_id');
  });

  it('validates dynamic payment settings rows before rendering', () => {
    expect(
      parsePaymentSettings(
        {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          new_bnpl_enabled: true,
          pay_on_delivery_limit: 10000,
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
      pay_on_delivery_limit: 10000,
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

  it('defaults omitted dynamic enabled fields to false', () => {
    expect(
      parsePaymentSettings(
        {
          id: 'settings-1',
          merchant_id: 'merchant-1',
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
      new_bnpl_enabled: false,
    });
  });

  it('treats nullable payment flags as disabled for legacy settings rows', () => {
    expect(
      parsePaymentSettings(
        {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          new_bnpl_enabled: null,
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
      new_bnpl_enabled: false,
    });
  });

  it('rejects malformed pay on delivery limits instead of dropping them', () => {
    expect(() =>
      parsePaymentSettings(
        {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          new_bnpl_enabled: true,
          pay_on_delivery_limit: '10000',
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
    ).toThrow('Invalid payment setting: pay_on_delivery_limit');
  });
});
