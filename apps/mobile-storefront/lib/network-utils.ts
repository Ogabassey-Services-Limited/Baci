/**
 * Nigerian Network Prefix Utility
 * 2026 Best Practice: Centralized network detection
 */

export type NetworkProvider = 'mtn' | 'airtel' | 'glo' | 't2';

const NETWORK_PREFIXES: Record<NetworkProvider, string[]> = {
  mtn: [
    '0703',
    '0706',
    '0803',
    '0806',
    '0810',
    '0813',
    '0814',
    '0816',
    '0903',
    '0906',
    '0913',
    '07025',
    '07026',
    '0704',
    '0916',
  ],
  airtel: [
    '0701',
    '0708',
    '0802',
    '0808',
    '0812',
    '0901',
    '0902',
    '0904',
    '0907',
    '0912',
  ],
  glo: ['0705', '0805', '0807', '0811', '0815', '0905', '0915'],
  t2: ['0809', '0817', '0818', '0908', '0909'],
};

/**
 * Detects the network provider based on the phone number prefix.
 * Handles both 080... and 23480... formats.
 */
export function detectNetwork(phoneNumber: string): NetworkProvider | null {
  // Remove all non-numeric characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Convert 234... to 0...
  if (cleaned.startsWith('234') && cleaned.length > 3) {
    cleaned = `0${cleaned.slice(3)}`;
  }

  // Normalize 10-digit format (e.g. 8031234567) to 11-digit (08031234567)
  if (cleaned.length === 10 && /^[789]/.test(cleaned)) {
    cleaned = `0${cleaned}`;
  }

  if (cleaned.length < 4) return null;

  // Check 5-digit prefixes first (e.g., 07025)
  for (const [provider, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    const match = prefixes.find((p) => p.length === 5 && cleaned.startsWith(p));
    if (match) return provider as NetworkProvider;
  }

  // Check 4-digit prefixes
  for (const [provider, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    const match = prefixes.find((p) => p.length === 4 && cleaned.startsWith(p));
    if (match) return provider as NetworkProvider;
  }

  return null;
}

/** Maps mobile provider IDs to Kuda API provider IDs */
export const MOBILE_TO_KUDA_PROVIDER: Record<string, string> = {
  mtn: 'MTN',
  airtel: 'AIRTEL',
  glo: 'GLO',
  t2: '9MOBILE',
};
