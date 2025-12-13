/**
 * Check if a password has been compromised in a data breach
 * Uses HaveIBeenPwned Pwned Passwords API with k-Anonymity
 *
 * How it works:
 * 1. Hash the password with SHA-1
 * 2. Send only the first 5 characters of the hash to the API
 * 3. API returns all hash suffixes that match that prefix
 * 4. Check locally if our full hash is in the returned list
 *
 * This means the actual password (or even its full hash) never leaves the client.
 */
export async function checkPasswordBreach(password: string): Promise<{
  isBreached: boolean;
  count?: number;
  error?: string;
}> {
  try {
    // Hash the password using SHA-1
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    // Split into prefix (first 5 chars) and suffix (rest)
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    // Setup abort controller for 3s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      // Query the HIBP API with just the prefix
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          headers: {
            'Add-Padding': 'true',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Silently fail if API is down/rate limited
        return { isBreached: false };
      }

      const text = await response.text();

      // Parse response - format is "SUFFIX:COUNT" per line
      const lines = text.split('\n');
      for (const line of lines) {
        const [hashSuffix, countStr] = line.split(':');
        if (hashSuffix.trim() === suffix) {
          const count = Number.parseInt(countStr.trim(), 10);
          return { isBreached: true, count };
        }
      }

      return { isBreached: false };
    } catch (fetchError) {
      // Network error or timeout - fail open
      clearTimeout(timeoutId);
      return { isBreached: false };
    }
  } catch (error) {
    // Crypto or other runtime errors
    console.error('Password breach check failed:', error);
    return { isBreached: false, error: 'Unable to verify password security' };
  }
}
