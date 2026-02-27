import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPasswordBreach } from '@/lib/password-breach';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkPasswordBreach', () => {
  it('should detect a breached password', async () => {
    // Mock fetch to return a breached hash
    // SHA-1 of 'password' is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // Prefix: 5BAA6
    // Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '1E4C9B93F3F0682250B6CF8331B7EE68FD8:100\nOTHERHASH:5'
          ),
      })
    );

    const result = await checkPasswordBreach('password');
    expect(result.isBreached).toBe(true);
    expect(result.count).toBe(100);
  });

  it('should detect a safe password', async () => {
    // Mock fetch to return no matching suffix
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('OTHERHASH:5\nANOTHERHASH:10'),
      })
    );

    const result = await checkPasswordBreach('safe-password-123');
    expect(result.isBreached).toBe(false);
  });

  it('should fail open (safe) when API fails', async () => {
    // Mock fetch failure
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    );

    const result = await checkPasswordBreach('password');
    expect(result.isBreached).toBe(false);
  });
});
