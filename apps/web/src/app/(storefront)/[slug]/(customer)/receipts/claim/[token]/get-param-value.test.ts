import { describe, expect, it } from 'vitest';
import { getParamValue } from './get-param-value';

describe('getParamValue', () => {
  it('reads route params safely', () => {
    expect(getParamValue('claim-token')).toBe('claim-token');
    expect(getParamValue(['claim-token', 'ignored'])).toBe('claim-token');
    expect(getParamValue(undefined)).toBe('');
  });
});
