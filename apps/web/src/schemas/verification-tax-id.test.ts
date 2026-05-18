import { describe, expect, it } from 'vitest';
import { taxIdVerifySchema } from '@/schemas/verification';

describe('taxIdVerifySchema', () => {
  it('normalizes and accepts a CAC-returned 13-digit tax id', () => {
    const result = taxIdVerifySchema.safeParse({
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
      taxIdentificationNumber: '123456789',
    });

    expect(result.success).toBe(false);
  });
});
