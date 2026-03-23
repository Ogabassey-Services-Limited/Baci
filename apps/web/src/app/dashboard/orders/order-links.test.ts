import { describe, expect, it } from 'vitest';
import { getDashboardOrderDetailsHref } from '@/app/dashboard/orders/order-links';

describe('getDashboardOrderDetailsHref', () => {
  it('returns a dashboard detail path for regular orders', () => {
    expect(
      getDashboardOrderDetailsHref({
        orderNumber: '#ORD-001',
        source: 'whatsapp',
      })
    ).toBe('/dashboard/orders/ORD-001');
  });

  it('keeps a regular order number intact when it has no hash prefix', () => {
    expect(
      getDashboardOrderDetailsHref({
        orderNumber: 'ORD-001',
        source: 'web',
      })
    ).toBe('/dashboard/orders/ORD-001');
  });

  it('encodes url-sensitive order numbers for non-jumia sources', () => {
    expect(
      getDashboardOrderDetailsHref({
        orderNumber: '#ORD/001?',
        source: 'instagram',
      })
    ).toBe('/dashboard/orders/ORD%2F001%3F');
  });

  it('returns null for blank order numbers', () => {
    expect(
      getDashboardOrderDetailsHref({
        orderNumber: '   ',
        source: 'whatsapp',
      })
    ).toBeNull();
  });

  it('returns null for empty order numbers', () => {
    expect(
      getDashboardOrderDetailsHref({
        orderNumber: '',
        source: 'whatsapp',
      })
    ).toBeNull();
  });

  it('returns null for jumia orders', () => {
    expect(
      getDashboardOrderDetailsHref({
        orderNumber: 'JUM-001',
        source: 'jumia',
      })
    ).toBeNull();
  });
});
