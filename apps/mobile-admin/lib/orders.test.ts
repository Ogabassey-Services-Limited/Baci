import { describe, expect, it } from 'vitest';
import { extractOrderDeliveryAddress, ORDER_COLUMNS } from '@/lib/orders';

describe('ORDER_COLUMNS', () => {
  it('includes the required mobile admin order columns', () => {
    expect(ORDER_COLUMNS.length).toBeGreaterThan(0);
    expect(ORDER_COLUMNS).toContain('id');
    expect(ORDER_COLUMNS).toContain('customer_name');
    expect(ORDER_COLUMNS).toContain('total');
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

  it('supports order-style address objects', () => {
    expect(
      extractOrderDeliveryAddress({
        address: '45 Marina Road',
        address_line1: 'Fallback line',
      })
    ).toBe('45 Marina Road');
  });

  it('returns null for unsupported or empty inputs', () => {
    expect(extractOrderDeliveryAddress(undefined)).toBeNull();
    expect(extractOrderDeliveryAddress(null)).toBeNull();
    expect(extractOrderDeliveryAddress({})).toBeNull();
  });
});
