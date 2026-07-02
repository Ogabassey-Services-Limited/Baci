import { describe, expect, it } from 'vitest';
import { imeiCheckSchema } from './imei-check';

describe('imeiCheckSchema', () => {
  it('parses a valid IMEI check payload', () => {
    const result = imeiCheckSchema.safeParse({
      imei: '354442067957452',
      tier: 'full',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        imei: '354442067957452',
        tier: 'full',
      });
    }
  });

  it('defaults tier to full', () => {
    const result = imeiCheckSchema.safeParse({
      imei: '354442067957452',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tier).toBe('full');
    }
  });

  it('accepts an Apple serial (8–14 alphanumeric) as the identifier', () => {
    // The schema now shape-checks IMEI-or-serial; the route enforces the exact
    // rule for the selected tier's identifier type.
    expect(
      imeiCheckSchema.safeParse({ imei: 'C02XL0ABJGH5', tier: 'full' }).success
    ).toBe(true);
  });

  it('rejects identifiers outside the 8–15 alphanumeric shape', () => {
    // 16+ digits, empty, spaces, and symbols are always malformed.
    expect(
      imeiCheckSchema.safeParse({ imei: '3544420679574520', tier: 'full' })
        .success
    ).toBe(false);
    expect(imeiCheckSchema.safeParse({ imei: '', tier: 'full' }).success).toBe(
      false
    );
    expect(
      imeiCheckSchema.safeParse({ imei: 'ABC12', tier: 'full' }).success
    ).toBe(false);
    expect(
      imeiCheckSchema.safeParse({ imei: '35 444 206 795 745', tier: 'full' })
        .success
    ).toBe(false);
    expect(
      imeiCheckSchema.safeParse({ imei: '35444-206795-745', tier: 'full' })
        .success
    ).toBe(false);
  });

  it('rejects unknown service tiers', () => {
    const result = imeiCheckSchema.safeParse({
      imei: '354442067957452',
      tier: 'unknown',
    });

    expect(result.success).toBe(false);
  });
});
