import 'server-only';

import { snapchatAdsProviderRateLimiter } from './rate-limit';

const MAX_RETRIES = 3;
export class SnapchatAdsProviderError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number
  ) {
    super(code);
    this.name = 'SnapchatAdsProviderError';
  }
}
function retryDelay(response: Response, attempt: number, random: () => number) {
  const hinted = Number(response.headers.get('retry-after'));
  const exponential = 250 * 2 ** attempt;
  return Math.min(
    60_000,
    Math.max(
      Number.isFinite(hinted) ? hinted * 1000 : 0,
      exponential + Math.floor(exponential * Math.max(0, Math.min(1, random())))
    )
  );
}
export async function requestSnapchatAdsJson(
  url: URL,
  init: RequestInit,
  failureCode: string,
  fetchImpl: typeof fetch = fetch,
  options: {
    random?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {}
): Promise<unknown> {
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    await snapchatAdsProviderRateLimiter.acquire();
    const response = await fetchImpl(url, init);
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      /* discard provider body */
    }
    if (response.status === 401 || response.status === 403)
      throw new SnapchatAdsProviderError(
        'SNAPCHAT_ADS_ACCESS_REVOKED',
        response.status
      );
    if (response.ok) return payload;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES - 1)
      throw new SnapchatAdsProviderError(
        response.status === 429 ? 'SNAPCHAT_ADS_THROTTLED' : failureCode,
        response.status
      );
    await sleep(retryDelay(response, attempt, random));
  }
  throw new SnapchatAdsProviderError(failureCode);
}
