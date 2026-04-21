import { describe, expect, it } from 'vitest';
import {
  formatOrderAddress,
  getOrderCurrencySymbol,
  getOrderSourceInfo,
  getOrderStatusColor,
} from './order-details.helpers';

const mockColors = {
  cancelled: '#6b7280',
  delivered: '#22c55e',
  error: '#ef4444',
  gold: '#f59e0b',
  pending: '#f59e0b',
  primary: '#3b82f6',
  processing: '#3b82f6',
  returned: '#a855f7',
  shipped: '#06b6d4',
  success: '#22c55e',
  textMuted: '#9ca3af',
  textSecondary: '#6b7280',
} as unknown as Parameters<typeof getOrderStatusColor>[0];

describe('getOrderStatusColor', () => {
  it('returns the correct color for paid status', () => {
    expect(getOrderStatusColor(mockColors, 'paid')).toBe(mockColors.success);
  });

  it('returns the correct color for pending status', () => {
    expect(getOrderStatusColor(mockColors, 'pending')).toBe(mockColors.pending);
  });

  it('returns the correct color for shipped status', () => {
    expect(getOrderStatusColor(mockColors, 'shipped')).toBe(mockColors.shipped);
  });

  it('returns the correct color for cancelled status', () => {
    expect(getOrderStatusColor(mockColors, 'cancelled')).toBe(
      mockColors.cancelled
    );
  });

  it('returns textSecondary for an unknown status key', () => {
    expect(getOrderStatusColor(mockColors, 'unknown')).toBe(
      mockColors.textSecondary
    );
  });

  it('returns textSecondary when key is undefined', () => {
    expect(getOrderStatusColor(mockColors, undefined)).toBe(
      mockColors.textSecondary
    );
  });
});

describe('getOrderCurrencySymbol', () => {
  it('returns ₦ for NGN', () => {
    expect(getOrderCurrencySymbol('NGN')).toBe('₦');
  });

  it('returns $ for USD', () => {
    expect(getOrderCurrencySymbol('USD')).toBe('$');
  });

  it('returns £ for GBP', () => {
    expect(getOrderCurrencySymbol('GBP')).toBe('£');
  });

  it('returns € for EUR', () => {
    expect(getOrderCurrencySymbol('EUR')).toBe('€');
  });

  it('returns ₦ for null (default)', () => {
    expect(getOrderCurrencySymbol(null)).toBe('₦');
  });

  it('returns ₦ for an unknown currency code', () => {
    expect(getOrderCurrencySymbol('XYZ')).toBe('₦');
  });
});

describe('getOrderSourceInfo', () => {
  it('returns Instagram info for instagram source', () => {
    const info = getOrderSourceInfo(mockColors, 'instagram');
    expect(info.label).toBe('Instagram');
    expect(info.name).toBe('logo-instagram');
  });

  it('returns WhatsApp info for whatsapp source', () => {
    const info = getOrderSourceInfo(mockColors, 'whatsapp');
    expect(info.label).toBe('WhatsApp');
  });

  it('returns Website info for online_store source', () => {
    const info = getOrderSourceInfo(mockColors, 'online_store');
    expect(info.label).toBe('Website');
  });

  it('returns Store info for physical source', () => {
    const info = getOrderSourceInfo(mockColors, 'physical');
    expect(info.label).toBe('Store');
  });

  it('returns a fallback for unknown source', () => {
    const info = getOrderSourceInfo(mockColors, 'unknown_channel');
    expect(info.label).toBe('Unknown_channel');
  });

  it('handles null source gracefully', () => {
    const info = getOrderSourceInfo(mockColors, null);
    expect(info.label).toBe('Order');
  });
});

describe('formatOrderAddress', () => {
  it('returns fallback message when address is null', () => {
    expect(formatOrderAddress(null)).toBe('No shipping address provided');
  });

  it('returns fallback message when address is undefined', () => {
    expect(formatOrderAddress(undefined)).toBe('No shipping address provided');
  });

  it('returns the string unchanged when address is a string', () => {
    expect(formatOrderAddress('12 Lagos Street')).toBe('12 Lagos Street');
  });

  it('joins address, city, and state with commas', () => {
    expect(
      formatOrderAddress({
        address: '12 Main St',
        city: 'Lagos',
        state: 'Lagos State',
      })
    ).toBe('12 Main St, Lagos, Lagos State');
  });

  it('omits null/undefined parts', () => {
    expect(
      formatOrderAddress({
        address: '12 Main St',
        city: null,
        state: undefined,
      })
    ).toBe('12 Main St');
  });

  it('returns fallback when all parts are null', () => {
    expect(formatOrderAddress({ address: null, city: null, state: null })).toBe(
      'No shipping address provided'
    );
  });
});
