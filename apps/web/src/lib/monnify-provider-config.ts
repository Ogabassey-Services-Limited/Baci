import 'server-only';

const DEFAULT_MONNIFY_BASE_URL = 'https://api.monnify.com';

/** Server-only capability for the exact credentials used by Monnify auth. */
export function getMonnifyCredentials(): {
  apiKey: string | undefined;
  secretKey: string | undefined;
} {
  return {
    apiKey: process.env.MONNIFY_API_KEY,
    secretKey: process.env.MONNIFY_SECRET_KEY,
  };
}

/** Provider endpoint configuration intentionally stays with its capability. */
export function getMonnifyBaseUrl(): string {
  return process.env.MONNIFY_BASE_URL || DEFAULT_MONNIFY_BASE_URL;
}
