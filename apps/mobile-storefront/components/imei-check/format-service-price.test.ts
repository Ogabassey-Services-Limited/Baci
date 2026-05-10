import { formatServicePrice } from './format-service-price';

describe('formatServicePrice', () => {
  it('formats zero as naira', () => {
    expect(formatServicePrice(0)).toBe('₦0');
  });

  it('formats decimal values with locale grouping', () => {
    expect(formatServicePrice(1999.5)).toBe('₦1,999.5');
  });

  it('formats large values with locale grouping', () => {
    expect(formatServicePrice(1_500_000)).toBe('₦1,500,000');
  });

  it('falls back to a NaN string when given NaN (documents current behavior)', () => {
    // toLocaleString('en-NG') returns 'NaN' for NaN inputs, so the formatter
    // surfaces 'NaN' rather than throwing. Pin this so callers can rely on it.
    expect(formatServicePrice(Number.NaN)).toBe('₦NaN');
  });

  it('formats negative values with the leading currency symbol preserved', () => {
    expect(formatServicePrice(-100)).toBe('₦-100');
  });
});
