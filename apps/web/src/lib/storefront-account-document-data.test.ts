import { describe, expect, it } from 'vitest';
import {
  getCurrentDocumentKind,
  isReceiptEligible,
  normalizePaymentStatus,
  normalizeShippingStatus,
} from '@/lib/storefront-account-document-data';

describe('storefront account document status helpers', () => {
  it('normalizes payment and shipping statuses to lowercase tokens', () => {
    expect(normalizePaymentStatus('PAID')).toBe('paid');
    expect(normalizePaymentStatus('Partially_Paid')).toBe('partially_paid');
    expect(normalizeShippingStatus('Shipped')).toBe('shipped');
    expect(normalizeShippingStatus('DELIVERED')).toBe('delivered');
  });

  it('returns empty strings for missing statuses and normalizes unknown values', () => {
    expect(normalizePaymentStatus(undefined)).toBe('');
    expect(normalizePaymentStatus(null)).toBe('');
    expect(normalizePaymentStatus('   ')).toBe('');
    expect(normalizeShippingStatus(undefined)).toBe('');
    expect(normalizeShippingStatus(null)).toBe('');
    expect(normalizeShippingStatus('Ready For Pickup')).toBe(
      'ready_for_pickup'
    );
  });

  it('marks receipts as eligible only when order is paid and shipped', () => {
    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'shipped',
      })
    ).toBe(true);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'delivered',
      })
    ).toBe(true);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'processing',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: 'partially_paid',
        shippingStatus: 'shipped',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: '',
        shippingStatus: 'delivered',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: undefined,
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'cancelled',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'returned',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: '',
        shippingStatus: '',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: '!'.repeat(120),
        shippingStatus: '@'.repeat(120),
      })
    ).toBe(false);
  });

  it('returns the current document kind from normalized status values', () => {
    expect(
      getCurrentDocumentKind({
        paymentStatus: 'PAID',
        shippingStatus: 'DELIVERED',
      })
    ).toBe('receipt');
    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'shipped',
      })
    ).toBe('receipt');

    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'processing',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: 'partially_paid',
        shippingStatus: 'shipped',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: '',
        shippingStatus: '',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'cancelled',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'pending',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: '!'.repeat(120),
        shippingStatus: '@'.repeat(120),
      })
    ).toBe('invoice');
  });
});
