import { describe, expect, it } from 'vitest';
import { adminMerchantsQuerySchema } from '@/schemas/admin-merchants-query';

describe('adminMerchantsQuerySchema', () => {
  it('defaults sortBy to gmv when omitted', () => {
    const result = adminMerchantsQuerySchema.parse({});

    expect(result.sortBy).toBe('gmv');
  });

  it('accepts the supported sort values', () => {
    for (const sortBy of ['gmv', 'orders', 'joined'] as const) {
      const result = adminMerchantsQuerySchema.parse({ sortBy });

      expect(result.sortBy).toBe(sortBy);
    }
  });

  it('rejects unsupported sort values', () => {
    const result = adminMerchantsQuerySchema.safeParse({
      sortBy: 'health',
    });

    expect(result.success).toBe(false);
  });
});
