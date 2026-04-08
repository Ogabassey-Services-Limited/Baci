import { describe, expect, it } from 'vitest';
import { paystackBankCodeSchema } from '@/schemas/paystack-bank-code';

describe('paystackBankCodeSchema', () => {
  describe('valid codes', () => {
    it.each([
      ['09', 'MINT-FINEX MFB (2-digit numeric)'],
      ['044', 'Access Bank (3-digit numeric)'],
      ['058', 'GTBank (3-digit numeric)'],
      ['50211', 'Kuda (5-digit numeric)'],
      ['999992', 'OPay (6-digit numeric)'],
      ['999991', 'PalmPay (6-digit numeric)'],
      ['120001', '9mobile (6-digit numeric)'],
      ['035A', 'ALAT by WEMA (alphanumeric)'],
      ['FC40163', 'Finance Company code (alphanumeric)'],
      ['MFB50992', 'MFB prefix code (alphanumeric)'],
      ['00zap', 'Zap (lowercase alphanumeric)'],
      ['D53', 'Fortress MFB (mixed case short)'],
    ])('accepts %s (%s)', (code) => {
      expect(paystackBankCodeSchema.safeParse(code).success).toBe(true);
    });

    it('trims surrounding whitespace before validating', () => {
      expect(paystackBankCodeSchema.parse('  058  ')).toBe('058');
    });
  });

  describe('invalid codes', () => {
    it.each([
      ['', 'empty string'],
      [' ', 'whitespace only'],
      ['x', 'single character'],
      ['ABC-123', 'contains hyphen'],
      ['bank code', 'contains space'],
      ['../../', 'path traversal attempt'],
      ['@@', 'punctuation only'],
      ['A'.repeat(17), '17-character string (too long)'],
    ])('rejects %j (%s)', (code) => {
      expect(paystackBankCodeSchema.safeParse(code).success).toBe(false);
    });
  });
});
