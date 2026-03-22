import { describe, expect, it } from 'vitest';
import {
  formatReceiptCurrency,
  formatReceiptDate,
} from '@/lib/receipt-pdf-formatters';

describe('receipt pdf formatters', () => {
  it('formats dates in UTC for stable receipt output', () => {
    expect(formatReceiptDate('2026-03-22T23:30:00.000Z')).toBe('22 Mar 2026');
  });

  it('preserves zero-minor-unit currency formatting', () => {
    expect(formatReceiptCurrency(150000, 'XOF')).not.toMatch(/[.,]00\b/);
  });

  it('returns a dash for invalid receipt dates', () => {
    expect(formatReceiptDate('not-a-date')).toBe('-');
  });
});
