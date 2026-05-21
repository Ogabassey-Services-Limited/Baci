import { describe, expect, it } from 'vitest';
import { parsePaymentSettings } from './payment-settings';

const newBnplDefinition = {
  category: 'bnpl',
  description: 'A newly integrated BNPL provider',
  enabledField: 'new_bnpl_enabled',
  id: 'new_bnpl',
  name: 'New BNPL',
} as const;

describe('parsePaymentSettings', () => {
  it('validates dynamic payment settings rows before rendering', () => {
    expect(
      parsePaymentSettings(
        {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          new_bnpl_enabled: true,
          pay_on_delivery_limit: 10000,
        },
        [newBnplDefinition]
      )
    ).toEqual({
      id: 'settings-1',
      merchant_id: 'merchant-1',
      new_bnpl_enabled: true,
      pay_on_delivery_limit: 10000,
    });
  });

  it('rejects malformed dynamic enabled fields', () => {
    expect(() =>
      parsePaymentSettings(
        {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          new_bnpl_enabled: 'yes',
        },
        [newBnplDefinition]
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
        [newBnplDefinition]
      )
    ).toEqual({
      id: 'settings-1',
      merchant_id: 'merchant-1',
      new_bnpl_enabled: false,
    });
  });

  it('rejects settings rows missing an id', () => {
    expect(() =>
      parsePaymentSettings(
        {
          merchant_id: 'merchant-1',
          new_bnpl_enabled: true,
        },
        [newBnplDefinition]
      )
    ).toThrow('Invalid payment setting: id');
  });

  it('rejects settings rows missing a merchant id', () => {
    expect(() =>
      parsePaymentSettings(
        {
          id: 'settings-1',
          new_bnpl_enabled: true,
        },
        [newBnplDefinition]
      )
    ).toThrow('Invalid payment setting: merchant_id');
  });

  it('treats nullable payment flags as disabled for legacy settings rows', () => {
    expect(
      parsePaymentSettings(
        {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          new_bnpl_enabled: null,
        },
        [newBnplDefinition]
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
        [newBnplDefinition]
      )
    ).toThrow('Invalid payment setting: pay_on_delivery_limit');
  });
});
