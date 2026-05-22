import { describe, expect, it } from 'vitest';
import { agenticCommerceHealthCronQuerySchema } from '@/schemas/agentic-commerce-health-cron';

describe('agenticCommerceHealthCronQuerySchema', () => {
  it('normalizes repeated and comma-separated merchant slugs', () => {
    const result = agenticCommerceHealthCronQuerySchema.safeParse({
      fail_on_attention: 'false',
      merchant_slug: ['Ogabassey, second-store', 'ogabassey'],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        fail_on_attention: false,
        merchant_slug: ['ogabassey', 'second-store'],
      });
    }
  });

  it('defaults to failing on attention and no explicit slugs', () => {
    const result = agenticCommerceHealthCronQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        fail_on_attention: true,
        merchant_slug: [],
      });
    }
  });

  it('rejects malformed merchant slugs', () => {
    const result = agenticCommerceHealthCronQuerySchema.safeParse({
      merchant_slug: ['../bad'],
    });

    expect(result.success).toBe(false);
  });
});
