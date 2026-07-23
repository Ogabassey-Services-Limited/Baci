import { beforeEach, describe, expect, it } from 'vitest';
import {
  CREDIT_DIRECT_POPUP_MARKER_PREFIX,
  clearCreditDirectPopupMarker,
  readCreditDirectPopupMarker,
  writeCreditDirectPopupMarker,
} from './credit-direct-popup-return';

describe('credit-direct popup marker storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('round-trips a marker for the same order', () => {
    writeCreditDirectPopupMarker('order-1', 'txn-123');

    const marker = readCreditDirectPopupMarker('order-1');

    expect(marker?.source).toBe('popup');
    expect(marker?.transactionId).toBe('txn-123');
    expect(typeof marker?.storedAt).toBe('string');
  });

  it('preserves SDK-success markers while treating legacy markers as popup returns', () => {
    writeCreditDirectPopupMarker('order-1', 'txn-123', 'sdk_success');
    window.sessionStorage.setItem(
      `${CREDIT_DIRECT_POPUP_MARKER_PREFIX}order-2`,
      JSON.stringify({
        transactionId: 'txn-legacy',
        storedAt: '2026-07-06T12:00:00.000Z',
      }),
    );

    expect(readCreditDirectPopupMarker('order-1')?.source).toBe('sdk_success');
    expect(readCreditDirectPopupMarker('order-2')?.source).toBe('popup');
  });

  it('returns null for a different order id', () => {
    writeCreditDirectPopupMarker('order-1', 'txn-123');

    expect(readCreditDirectPopupMarker('order-2')).toBeNull();
  });

  it('returns null when the order id is missing', () => {
    expect(readCreditDirectPopupMarker(null)).toBeNull();
  });

  it('returns null for corrupted stored JSON', () => {
    window.sessionStorage.setItem(
      `${CREDIT_DIRECT_POPUP_MARKER_PREFIX}order-1`,
      'not-json',
    );

    expect(readCreditDirectPopupMarker('order-1')).toBeNull();
  });

  it('returns null when the stored value has no transaction id', () => {
    window.sessionStorage.setItem(
      `${CREDIT_DIRECT_POPUP_MARKER_PREFIX}order-1`,
      JSON.stringify({ storedAt: '2026-07-06T12:00:00.000Z' }),
    );

    expect(readCreditDirectPopupMarker('order-1')).toBeNull();
  });

  it('clears the stored marker', () => {
    writeCreditDirectPopupMarker('order-1', 'txn-123');

    clearCreditDirectPopupMarker('order-1');

    expect(readCreditDirectPopupMarker('order-1')).toBeNull();
  });
});
