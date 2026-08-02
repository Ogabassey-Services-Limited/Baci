import * as Crypto from 'expo-crypto';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range';
const BREACH_CHECK_TIMEOUT_MS = 3000;

export async function checkPasswordBreach(password: string): Promise<{
  count?: number;
  isBreached: boolean;
}> {
  try {
    const hash = (
      await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA1,
        password
      )
    ).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      BREACH_CHECK_TIMEOUT_MS
    );

    try {
      const response = await fetch(`${HIBP_RANGE_URL}/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: controller.signal,
      });
      if (!response.ok) {
        return { isBreached: false };
      }

      const matches = (await response.text()).split('\n');
      for (const match of matches) {
        const [candidateSuffix, countText] = match.trim().split(':');
        if (candidateSuffix === suffix) {
          return {
            count: Number.parseInt(countText, 10),
            isBreached: true,
          };
        }
      }
      return { isBreached: false };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    // Breach lookups are defense in depth. Connectivity or provider failures
    // must not make account creation unavailable.
    return { isBreached: false };
  }
}
