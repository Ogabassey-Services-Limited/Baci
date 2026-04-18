import { describe, expect, it } from 'vitest';
import { detectNetworkProvider } from './detect-network-provider';

describe('detectNetworkProvider', () => {
  it('detects known Nigerian mobile prefixes', () => {
    expect(detectNetworkProvider('08031234567')).toBe('MTN');
    expect(detectNetworkProvider('08021234567')).toBe('AIRTEL');
    expect(detectNetworkProvider('08051234567')).toBe('GLO');
    expect(detectNetworkProvider('08091234567')).toBe('9MOBILE');
  });

  it('normalizes international numbers before matching prefixes', () => {
    expect(detectNetworkProvider('+2348031234567')).toBe('MTN');
    expect(detectNetworkProvider('234 812 123 4567')).toBe('AIRTEL');
  });

  it('returns null for unknown prefixes', () => {
    expect(detectNetworkProvider('07001234567')).toBeNull();
  });
});
