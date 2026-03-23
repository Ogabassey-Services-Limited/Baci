import { describe, expect, it } from 'vitest';
import { extractOrderDeliveryAddress, ORDER_COLUMNS } from '@/lib/orders';

describe('ORDER_COLUMNS', () => {
  it('does not request non-existent orders columns', () => {
    expect(ORDER_COLUMNS).not.toContain('customer_address');
    expect(ORDER_COLUMNS).not.toContain('discount_code');
  });
});

describe('extractOrderDeliveryAddress', () => {
  it('returns a trimmed string address', () => {
    expect(extractOrderDeliveryAddress('  12 Allen Ave  ')).toBe(
      '12 Allen Ave'
    );
  });

  it('prefers address from shipping address objects', () => {
    expect(
      extractOrderDeliveryAddress({
        address: '45 Marina Road',
        address_line1: 'Fallback line',
      })
    ).toBe('45 Marina Road');
  });

  it('falls back to address_line1 when address is missing', () => {
    expect(
      extractOrderDeliveryAddress({
        address_line1: '7 Admiralty Way',
      })
    ).toBe('7 Admiralty Way');
  });

  it('returns null for unsupported values', () => {
    expect(extractOrderDeliveryAddress(null)).toBeNull();
    expect(extractOrderDeliveryAddress(undefined)).toBeNull();
    expect(extractOrderDeliveryAddress({})).toBeNull();
    expect(extractOrderDeliveryAddress(123)).toBeNull();
    expect(extractOrderDeliveryAddress(true)).toBeNull();
    expect(extractOrderDeliveryAddress([])).toBeNull();
  });

  it('falls back to address_line1 when address is an empty string', () => {
    expect(
      extractOrderDeliveryAddress({
        address: '',
        address_line1: '7 Admiralty Way',
      })
    ).toBe('7 Admiralty Way');
  });
});
