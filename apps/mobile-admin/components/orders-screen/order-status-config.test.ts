import { describe, expect, it } from 'vitest';
import { createPaymentStatusConfigGetter } from './create-payment-status-config-getter';
import { createShippingStatusConfigGetter } from './create-shipping-status-config-getter';
import { createSourceConfigGetter } from './create-source-config-getter';
import { getColorFromKey } from './get-color-from-key';
import { getStatusActions } from './get-status-actions';
import { mockColors } from './orders-screen-test-utils';

describe('order-status-config', () => {
  it('maps status color keys through theme colors', () => {
    expect(getColorFromKey(mockColors, 'pending')).toBe(mockColors.pending);
    expect(getColorFromKey(mockColors, 'unknown')).toBe(mockColors.textMuted);
  });

  it('creates display config getters for shipping, payment, and source values', () => {
    expect(
      createShippingStatusConfigGetter(mockColors)('pending')
    ).toMatchObject({
      color: mockColors.pending,
      label: expect.any(String),
    });
    expect(createPaymentStatusConfigGetter(mockColors)('paid')).toMatchObject({
      color: mockColors.success,
      label: expect.any(String),
    });
    expect(createSourceConfigGetter(mockColors)('online_store')).toMatchObject({
      label: 'Website',
    });
  });

  it('returns allowed next shipping status actions', () => {
    expect(getStatusActions(mockColors, 'pending')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'processing' }),
      ])
    );
  });
});
