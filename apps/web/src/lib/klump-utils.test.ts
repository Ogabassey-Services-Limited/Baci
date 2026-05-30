import { describe, expect, it } from 'vitest';
import {
  buildKlumpItems,
  getUnmaskedValue,
  normalizeKlumpPhone,
  toCurrencyAmount,
} from '@/lib/klump-utils';

describe('klump-utils', () => {
  it('normalizes Nigerian phone numbers for Klump', () => {
    expect(normalizeKlumpPhone('+234 801 234 5678')).toBe('08012345678');
    expect(normalizeKlumpPhone('8012345678')).toBe('08012345678');
  });

  it('prefers unmasked customer values', () => {
    expect(getUnmaskedValue('cu***@example.com', 'buyer@example.com')).toBe(
      'buyer@example.com'
    );
  });

  it('normalizes currency amounts to positive two-decimal values', () => {
    expect(toCurrencyAmount('58088.555')).toBe(58088.56);
    expect(toCurrencyAmount('invalid')).toBe(0);
  });

  it('balances Klump items to the order total', () => {
    expect(
      buildKlumpItems({
        id: 'order-1',
        total: 58_088.5,
        shipping_cost: 2726,
        items: [
          {
            name: 'Capsule',
            price: 51_500,
            quantity: 1,
          },
        ],
      })
    ).toEqual([
      { name: 'Capsule', quantity: 1, unit_price: 51_500 },
      { name: 'Delivery', quantity: 1, unit_price: 2726 },
      { name: 'Taxes and fees', quantity: 1, unit_price: 3862.5 },
    ]);
  });
});
