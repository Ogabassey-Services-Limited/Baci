import { describe, expect, it } from '@jest/globals';
import {
  formatUtilityHistoryAmount,
  formatUtilityHistoryDate,
  getUtilityHistoryTransactionDetail,
  getUtilityHistoryTransactionTitle,
  resolveUtilityHistoryFilter,
} from './history.helpers';

describe('history.helpers', () => {
  it('returns a supported filter and falls back to all for unknown values', () => {
    expect(resolveUtilityHistoryFilter('power')).toBe('power');
    expect(resolveUtilityHistoryFilter('unsupported')).toBe('all');
    expect(resolveUtilityHistoryFilter(undefined)).toBe('all');
  });

  it('formats amounts for the storefront currency locale', () => {
    expect(formatUtilityHistoryAmount(2500)).toContain('2,500');
  });

  it('prefers merchant labels for transaction titles and details', () => {
    expect(
      getUtilityHistoryTransactionTitle({
        type: 'electricity',
        biller_name: 'EKEDC NG',
        network_provider: 'Provider Name',
      })
    ).toBe('EKEDC NG');

    expect(
      getUtilityHistoryTransactionDetail({
        type: 'data',
        phone_number: '08012345678',
      })
    ).toBe('08012345678');
  });

  it('falls back to type labels and missing-data copy when fields are absent', () => {
    expect(
      getUtilityHistoryTransactionTitle({
        type: 'betting',
        biller_name: null,
        network_provider: null,
      })
    ).toBe('Gaming');
    expect(
      getUtilityHistoryTransactionTitle({
        type: 'betting',
        biller_name: '',
        network_provider: '',
      })
    ).toBe('Gaming');
    expect(
      getUtilityHistoryTransactionTitle({
        type: 'betting',
        biller_name: undefined,
        network_provider: undefined,
      })
    ).toBe('Gaming');

    expect(
      getUtilityHistoryTransactionDetail({
        type: 'electricity',
        customer_identifier: null,
        customer_name: null,
      })
    ).toBe('Customer identifier unavailable');
    expect(
      getUtilityHistoryTransactionDetail({
        type: 'electricity',
        customer_identifier: '',
        customer_name: '',
      })
    ).toBe('Customer identifier unavailable');
  });

  it('returns a safe fallback for invalid dates', () => {
    expect(formatUtilityHistoryDate('not-a-date')).toBe('-');
  });
});
