import { describe, expect, it } from 'vitest';
import { merchantIdParamSchema } from './merchant-id-param';

describe('merchantIdParamSchema', () => {
  it('accepts a UUID', () => {
    expect(
      merchantIdParamSchema.safeParse('33333333-3333-4333-8333-333333333333')
        .success
    ).toBe(true);
  });

  it.each([
    ['a plain word', 'my-store'],
    ['an empty string', ''],
    ['a truncated UUID', '33333333-3333'],
  ])('rejects %s so the caller gets 400, not a misleading 404', (_l, value) => {
    // getMerchantForApiRequest compares this against UUID columns; a malformed
    // value produced a driver error the resolver collapsed into `null`.
    expect(merchantIdParamSchema.safeParse(value).success).toBe(false);
  });
});
