import { describe, expect, it } from 'vitest';
import { formatTransactionDisplayText } from './transaction-display-format';

describe('formatTransactionDisplayText', () => {
  it('labels transfer payment methods as Bank Transfer', () => {
    expect(
      formatTransactionDisplayText('transfer', { paymentMethod: true })
    ).toBe('Bank Transfer');
    expect(
      formatTransactionDisplayText('bank_transfer', { paymentMethod: true })
    ).toBe('Bank Transfer');
    expect(
      formatTransactionDisplayText(' bank transfer ', { paymentMethod: true })
    ).toBe('Bank Transfer');
  });

  it('sentence-cases display text while preserving iPhone and iPad tokens', () => {
    expect(formatTransactionDisplayText('kayode GOODNESS')).toBe(
      'Kayode goodness'
    );
    expect(formatTransactionDisplayText('HP EliteBook X360 1040 G10')).toBe(
      'Hp elitebook x360 1040 g10'
    );
    expect(formatTransactionDisplayText('13" iPad Air M3 256GB LTE')).toBe(
      '13" iPad air m3 256gb lte'
    );
    expect(formatTransactionDisplayText('IPHONE 14 PRO MAX')).toBe(
      'iPhone 14 pro max'
    );
  });
});
