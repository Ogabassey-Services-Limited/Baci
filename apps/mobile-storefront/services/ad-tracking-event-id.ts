import * as Crypto from 'expo-crypto';

/**
 * Generate a unique event ID for deduplication.
 * This ID is sent to both client-side SDKs and server-side APIs.
 */
export async function generateEventId(): Promise<string> {
  const timestamp = Date.now().toString(36);
  const randomBytes = await Crypto.getRandomBytesAsync(8);
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${timestamp}_${randomHex}`;
}

export function generateEventIdSync(): string {
  const timestamp = Date.now().toString(36);
  const cryptoUuid =
    typeof Crypto.randomUUID === 'function' ? Crypto.randomUUID() : null;
  const random =
    typeof cryptoUuid === 'string' && cryptoUuid.length > 0
      ? cryptoUuid.replace(/-/g, '').substring(0, 10)
      : Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `${timestamp}_${random}`;
}
