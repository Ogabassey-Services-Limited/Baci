import { describe, expect, it } from 'vitest';
import {
  formatAnalyticsCurrency,
  formatAnalyticsNumber,
  formatAnalyticsPercentage,
} from './analytics-format';

describe('analytics formatting', () => {
  it('formats monetary totals in compact form only when appropriate', () => {
    expect(formatAnalyticsCurrency(999)).toBe('₦999.00');
    expect(formatAnalyticsCurrency(1200)).toBe('₦1.2K');
  });

  it('formats large counts and absolute percentage changes', () => {
    expect(formatAnalyticsNumber(1250)).toBe('1.3K');
    expect(formatAnalyticsNumber(1200000)).toBe('1.2M');
    expect(formatAnalyticsPercentage(-10)).toBe('10.0%');
  });
});
