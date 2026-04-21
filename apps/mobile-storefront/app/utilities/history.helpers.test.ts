import { describe, expect, it } from '@jest/globals';
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
});
