import { describe, expect, it } from 'vitest';
import {
  buildReadOnlyDefaultFeatureSettings,
  merchantFeatureSelectFields,
} from './merchant-feature-settings-contract';

describe('merchant feature settings contract', () => {
  it('builds a complete read-only default record for the requested merchant', () => {
    const settings = buildReadOnlyDefaultFeatureSettings('merchant-1');

    expect(settings).toMatchObject({
      id: null,
      merchant_id: 'merchant-1',
      created_at: null,
      updated_at: null,
      paystack_enabled: true,
    });
    expect(Object.keys(settings).sort()).toEqual(
      [...merchantFeatureSelectFields].sort()
    );
  });

  it('binds the absent-settings defaults to each requested merchant', () => {
    const first = buildReadOnlyDefaultFeatureSettings('merchant-1');
    const second = buildReadOnlyDefaultFeatureSettings('merchant-2');

    expect(first.merchant_id).toBe('merchant-1');
    expect(second).toMatchObject({
      merchant_id: 'merchant-2',
      custom_settings: {},
    });
  });
});
