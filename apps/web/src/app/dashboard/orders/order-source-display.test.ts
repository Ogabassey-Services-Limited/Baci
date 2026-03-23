import { describe, expect, it } from 'vitest';
import { getOrderSourceLabel } from '@/app/dashboard/orders/order-source-display';

describe('getOrderSourceLabel', () => {
  it('returns shared labels for known order sources', () => {
    expect(getOrderSourceLabel('online_store')).toBe('Website');
    expect(getOrderSourceLabel('storefront')).toBe('Website');
    expect(getOrderSourceLabel('web')).toBe('Website');
    expect(getOrderSourceLabel('website')).toBe('Website');
    expect(getOrderSourceLabel('whatsapp')).toBe('WhatsApp');
  });

  it('formats unknown sources into readable labels', () => {
    expect(getOrderSourceLabel('credit_direct')).toBe('Credit Direct');
    expect(getOrderSourceLabel('some_long_source_name')).toBe(
      'Some Long Source Name'
    );
  });

  it('falls back to a generic order label when the source is empty', () => {
    expect(getOrderSourceLabel('')).toBe('Order');
    expect(getOrderSourceLabel(undefined as never)).toBe('Order');
    expect(getOrderSourceLabel(null as never)).toBe('Order');
  });

  it('returns a readable label for single-word fallback sources', () => {
    expect(getOrderSourceLabel('manual')).toBe('Manual');
  });
});
