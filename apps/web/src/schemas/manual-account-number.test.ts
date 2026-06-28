import { describe, expect, it } from 'vitest';
import {
  isValidManualAccountNumber,
  normalizeManualAccountNumber,
} from '@/schemas/manual-account-number';

describe('manual account number helpers', () => {
  it('normalizes spaces and hyphens before length checks', () => {
    expect(normalizeManualAccountNumber('AB12 CD34-EF56')).toBe('AB12CD34EF56');
  });

  it('accepts manual account numbers with supported separators', () => {
    expect(isValidManualAccountNumber('AB12 CD34-EF56')).toBe(true);
  });

  it('rejects unsupported characters and normalized values outside range', () => {
    expect(isValidManualAccountNumber('AB12_CD34')).toBe(false);
    expect(isValidManualAccountNumber('AB-12 3')).toBe(false);
    expect(
      isValidManualAccountNumber('AB12 CD34 EF56 GH78 IJ90 KL12 MN34 OP56 QR7')
    ).toBe(false);
  });
});
