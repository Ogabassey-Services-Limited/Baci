import 'server-only';

import { tiktokAdsProviderRateLimiter } from './rate-limit';

const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 2_000;
const REVOKED_TOKEN_CODES = new Set([
  '40101',
  '40102',
  'access_token_expired',
  'access_token_invalid',
]);

export class TikTokAdsProviderError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, status?: number) {
    super(code);
    this.code = code;
    this.name = 'TikTokAdsProviderError';
    this.status = status;
  }
}

function payloadCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number'
    ? String(code)
    : null;
}

function retryDelay(
  response: Response,
  attempt: number,
  random: () => number
): number {
  const retryAfterSeconds = Number(response.headers.get('retry-after'));
  const retryAfter = Number.isFinite(retryAfterSeconds)
    ? retryAfterSeconds * 1000
    : 0;
  const exponential = 250 * 2 ** attempt;
  const jitter = Math.floor(exponential * Math.min(1, Math.max(0, random())));
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(retryAfter, exponential + jitter)
  );
}

export async function requestTikTokAdsJson(
  url: URL,
  init: RequestInit,
  failureCode: string,
  fetchImpl: typeof fetch,
  options: {
    random?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {}
): Promise<unknown> {
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    await tiktokAdsProviderRateLimiter.acquire();
    const response = await fetchImpl(url, init);
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Deliberately discard untrusted provider response bodies.
    }
    const code = payloadCode(payload);
    if (response.status === 401 || (code && REVOKED_TOKEN_CODES.has(code)))
      throw new TikTokAdsProviderError(
        'TIKTOK_ADS_ACCESS_REVOKED',
        response.status
      );
    const throttled =
      response.status === 429 ||
      code === '40100' ||
      response.headers.has('x-tt-ads-throttle');
    if (response.ok && code === '0' && !throttled) return payload;
    const retryable = throttled || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES - 1)
      throw new TikTokAdsProviderError(
        throttled ? 'TIKTOK_ADS_THROTTLED' : failureCode,
        response.status
      );
    await sleep(retryDelay(response, attempt, random));
  }
  throw new TikTokAdsProviderError(failureCode);
}
