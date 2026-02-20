import { isValidIMEI } from './validation';

describe('isValidIMEI', () => {
  it('accepts a valid IMEI (Luhn check passes)', () => {
    // Known valid IMEI: 490154203237518
    expect(isValidIMEI('490154203237518')).toBe(true);
  });

  it('accepts another valid IMEI', () => {
    expect(isValidIMEI('353456789012345')).toBe(true);
  });

  it('rejects an IMEI with invalid checksum', () => {
    // Change the last digit of a valid IMEI
    expect(isValidIMEI('490154203237519')).toBe(false);
  });

  it('rejects a string that is too short', () => {
    expect(isValidIMEI('49015420323')).toBe(false);
  });

  it('rejects a string that is too long', () => {
    expect(isValidIMEI('4901542032375180')).toBe(false);
  });

  it('rejects a string with non-digit characters', () => {
    expect(isValidIMEI('49015420323751a')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidIMEI('')).toBe(false);
  });

  it('rejects a string with spaces', () => {
    expect(isValidIMEI('490 154 203 237')).toBe(false);
  });
});
