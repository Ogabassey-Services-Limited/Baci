import { describe, expect, it } from 'vitest';
import { isAdminGiglEnabled } from './admin-order-gigl-quote';

describe('Admin GIGL provider feature eligibility', () => {
  it('accepts case-insensitive gigl provider settings', () => {
    expect(isAdminGiglEnabled(['topship', 'GIGL'])).toBe(true);
  });
  it('fails closed when settings are missing or gigl is disabled', () => {
    expect(isAdminGiglEnabled(undefined)).toBe(false);
    expect(isAdminGiglEnabled(['topship'])).toBe(false);
  });
});
