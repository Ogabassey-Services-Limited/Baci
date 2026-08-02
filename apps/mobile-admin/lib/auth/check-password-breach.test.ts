import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  digestStringAsync: vi.fn(),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA1: 'SHA-1' },
  digestStringAsync: mocks.digestStringAsync,
}));

import { checkPasswordBreach } from './check-password-breach';

describe('checkPasswordBreach', () => {
  const suffix = 'F'.repeat(35);

  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.digestStringAsync.mockResolvedValue(`ABCDE${suffix}`);
  });

  it('uses HIBP k-anonymity and detects a matching hash suffix', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(`${suffix}:42\n${'0'.repeat(35)}:1`, { status: 200 })
      );

    await expect(checkPasswordBreach('raw-secret')).resolves.toEqual({
      count: 42,
      isBreached: true,
    });
    expect(mocks.digestStringAsync).toHaveBeenCalledWith('SHA-1', 'raw-secret');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.pwnedpasswords.com/range/ABCDE',
      expect.objectContaining({ headers: { 'Add-Padding': 'true' } })
    );
    expect(JSON.stringify(fetchSpy.mock.calls)).not.toContain('raw-secret');
    expect(JSON.stringify(fetchSpy.mock.calls)).not.toContain(suffix);
  });

  it('fails open without exposing provider or connectivity errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('provider down'));

    await expect(checkPasswordBreach('raw-secret')).resolves.toEqual({
      isBreached: false,
    });
  });
});
