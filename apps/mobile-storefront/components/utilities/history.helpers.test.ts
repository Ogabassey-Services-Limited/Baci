import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_UTILITY_HISTORY_STATUS_COLOR,
  DEFAULT_UTILITY_HISTORY_STATUS_LABEL,
  UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS,
  UTILITY_HISTORY_STATUS_COLORS,
  UTILITY_HISTORY_STATUS_META,
} from './history.constants';
import { utilityHistoryHelpers } from './history.helpers';

describe('history.helpers', () => {
  it('returns a supported filter and falls back to all for unknown values', () => {
    expect(utilityHistoryHelpers.resolveFilter('power')).toBe('power');
    expect(utilityHistoryHelpers.resolveFilter('unsupported')).toBe('all');
    expect(utilityHistoryHelpers.resolveFilter(undefined)).toBe('all');
  });

  it('formats amounts for the storefront currency locale without dropping Kobo', () => {
    expect(utilityHistoryHelpers.formatAmount(2500)).toContain('2,500');
    expect(utilityHistoryHelpers.formatAmount(2500.75)).toContain('2,500.75');
  });

  it('prefers merchant labels for transaction titles and details', () => {
    expect(
      utilityHistoryHelpers.getTransactionTitle({
        type: 'electricity',
        biller_name: 'EKEDC NG',
        network_provider: 'Provider Name',
      })
    ).toBe('EKEDC NG');

    expect(
      utilityHistoryHelpers.getTransactionDetail({
        type: 'data',
        phone_number: '08012345678',
      })
    ).toBe('08012345678');
  });

  it('falls back to type labels and missing-data copy when fields are absent', () => {
    expect(
      utilityHistoryHelpers.getTransactionTitle({
        type: 'betting',
        biller_name: null,
        network_provider: null,
      })
    ).toBe('Gaming');
    expect(
      utilityHistoryHelpers.getTransactionTitle({
        type: 'betting',
        biller_name: '',
        network_provider: '',
      })
    ).toBe('Gaming');
    expect(
      utilityHistoryHelpers.getTransactionTitle({
        type: 'betting',
        biller_name: undefined,
        network_provider: undefined,
      })
    ).toBe('Gaming');

    expect(
      utilityHistoryHelpers.getTransactionDetail({
        type: 'electricity',
        customer_identifier: null,
        customer_name: null,
      })
    ).toBe('Customer identifier unavailable');
    expect(
      utilityHistoryHelpers.getTransactionDetail({
        type: 'electricity',
        customer_identifier: '',
        customer_name: '',
      })
    ).toBe('Customer identifier unavailable');
  });

  it('returns a safe fallback for invalid dates', () => {
    expect(utilityHistoryHelpers.formatDate('not-a-date')).toBe('-');
  });

  it('reports completed gateway payments as payment received when fulfillment did not succeed', () => {
    expect(
      utilityHistoryHelpers.getDisplayStatus({
        payment_status: 'completed',
        status: 'failed',
      })
    ).toEqual({
      color: UTILITY_HISTORY_STATUS_COLORS.paymentReceived,
      label: UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS.label,
      message: UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS.message,
    });
  });

  it('uses the transaction status color and label for normal statuses', () => {
    expect(
      utilityHistoryHelpers.getDisplayStatus({
        payment_status: 'pending',
        status: 'processing',
      })
    ).toEqual({
      color: UTILITY_HISTORY_STATUS_COLORS.processing,
      label: UTILITY_HISTORY_STATUS_META.processing.label,
      message: null,
    });
  });

  it('falls back safely for unknown utility statuses', () => {
    const invalidStatusInput = {
      payment_status: 'pending',
      status: 'unknown',
    };

    expect(
      // @ts-expect-error testing invalid input
      utilityHistoryHelpers.getDisplayStatus(invalidStatusInput)
    ).toEqual({
      color: DEFAULT_UTILITY_HISTORY_STATUS_COLOR,
      label: DEFAULT_UTILITY_HISTORY_STATUS_LABEL,
      message: null,
    });
  });
});
