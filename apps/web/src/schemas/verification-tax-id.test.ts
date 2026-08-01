import { describe, expect, it } from 'vitest';
import { taxIdVerifySchema } from '@/schemas/verification';

describe('taxIdVerifySchema', () => {
  it('normalizes and accepts a CAC-returned 13-digit tax id', () => {
    const result = taxIdVerifySchema.safeParse({
      merchantId: '11111111-1111-4111-8111-111111111111',
      taxIdentificationNumber: ' 252-259-9781276 ',
      legalEntityName: 'OGABASSEY SERVICES LIMITED',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxIdentificationNumber).toBe('2522599781276');
    }
  });

  it('rejects tax ids that are too short', () => {
    const result = taxIdVerifySchema.safeParse({
      merchantId: '11111111-1111-4111-8111-111111111111',
      taxIdentificationNumber: '123456789',
    });

    expect(result.success).toBe(false);
  });

  it('rejects verification payloads without an explicit merchant ID', () => {
    const result = taxIdVerifySchema.safeParse({
      taxIdentificationNumber: '2522599781276',
    });

    expect(result.success).toBe(false);
  });
});
