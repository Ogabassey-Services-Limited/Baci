import { describe, expect, it } from 'vitest';
import { adminAnalyticsQuerySchema } from './admin-analytics-query';

describe('adminAnalyticsQuerySchema', () => {
  it('defaults period to all when omitted', () => {
    expect(adminAnalyticsQuerySchema.parse({})).toEqual({ period: 'all' });
  });

  it('accepts supported periods', () => {
    expect(adminAnalyticsQuerySchema.parse({ period: '7d' })).toEqual({
      period: '7d',
    });
    expect(adminAnalyticsQuerySchema.parse({ period: 'all' })).toEqual({
      period: 'all',
    });
  });

  it('rejects unsupported periods', () => {
    const result = adminAnalyticsQuerySchema.safeParse({ period: '14d' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(
        /Invalid enum value|expected one of/
      );
    }
  });
});
