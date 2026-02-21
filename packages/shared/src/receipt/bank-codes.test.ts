import { describe, expect, it } from 'vitest';
import { getBankNameFromCode } from './bank-codes';

describe('getBankNameFromCode', () => {
  it('returns matching bank name when code exists', () => {
    expect(getBankNameFromCode('058')).toBe('Guaranty Trust Bank');
  });

  it('returns null for missing or unknown codes', () => {
    expect(getBankNameFromCode(null)).toBeNull();
    expect(getBankNameFromCode('unknown')).toBeNull();
  });
});
