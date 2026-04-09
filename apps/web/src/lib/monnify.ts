import { withRetry } from '@/ai/provider';
import { getMonnifyApiKey, getMonnifySecretKey } from '@/env';
import type { MonnifyAuthResponse } from '@/types/monnify';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const CACHE_KEY = 'monnify_token';
const EXPIRY_BUFFER_MS = 60 * 1000; // 60 second buffer before expiry

/** Exposed for testing only — clears the in-memory token cache. */
export function clearMonnifyTokenCache(): void {
  tokenCache.clear();
}

export async function getMonnifyToken(): Promise<string> {
  const apiKey = getMonnifyApiKey();
  const secretKey = getMonnifySecretKey();

  if (!apiKey || !secretKey) {
    throw new Error('Monnify credentials not configured');
  }

  const cached = tokenCache.get(CACHE_KEY);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  const credentials = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

  const response = await withRetry(async () => {
    const res = await fetch('https://api.monnify.com/api/v1/auth/login', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Monnify auth failed: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<MonnifyAuthResponse>;
  });

  if (!response.requestSuccessful) {
    throw new Error(
      response.responseMessage ?? 'Monnify authentication failed'
    );
  }

  if (!response.responseBody) {
    throw new Error('Monnify authentication response missing token');
  }
  const { accessToken, expiresIn } = response.responseBody;
  const expiresAt = Date.now() + expiresIn * 1000 - EXPIRY_BUFFER_MS;

  tokenCache.set(CACHE_KEY, { accessToken, expiresAt });

  return accessToken;
}
