import { describe, expect, it } from 'vitest';
import { isValidImeiChecksum } from './route-helpers';

describe('isValidImeiChecksum', () => {
  it('rejects empty, short, and non-numeric IMEI values before checksum math', () => {
    expect(isValidImeiChecksum('')).toBe(false);
    expect(isValidImeiChecksum('49015420323751')).toBe(false);
    expect(isValidImeiChecksum('49015420323751x')).toBe(false);
  });

  it('validates 15-digit IMEI checksums', () => {
    expect(isValidImeiChecksum('490154203237518')).toBe(true);
    expect(isValidImeiChecksum('123456789012345')).toBe(false);
  });
});
