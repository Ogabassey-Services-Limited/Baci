import { describe, expect, it } from 'vitest';
import { imeiCheckSchema } from './imei-check';

describe('imeiCheckSchema', () => {
  it('accepts an IMEI with an optional tier', () => {
    expect(
      imeiCheckSchema.safeParse({
        imei: '354442067957452',
        tier: 'full',
      }).success
    ).toBe(true);
  });

  it('rejects payloads without an IMEI string', () => {
    expect(imeiCheckSchema.safeParse({ tier: 'full' }).success).toBe(false);
    expect(imeiCheckSchema.safeParse({ imei: 354442067957452 }).success).toBe(
      false
    );
  });
});
