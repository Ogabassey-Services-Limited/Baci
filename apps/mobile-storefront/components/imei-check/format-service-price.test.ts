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
});
