export const PARITY_FETCH_TIMEOUT_MS = 5_000;
export const PARITY_FEED_FETCH_TIMEOUT_MS = 30_000;
export const MAX_PARITY_REDIRECTS = 3;

interface PublicProductParityFetchOptions {
  accept: string;
  expectedOrigin: string;
  timeoutMs?: number;
}

export async function fetchPublicProductParityResponse(
  fetcher: typeof fetch,
  url: string,
  options: PublicProductParityFetchOptions
): Promise<Response | null> {
  let requestUrl = url;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_PARITY_REDIRECTS;
    redirectCount++
  ) {
    try {
      if (new URL(requestUrl).origin !== options.expectedOrigin) return null;

      const response = await fetcher(requestUrl, {
        cache: 'no-store',
        headers: { accept: options.accept },
        redirect: 'manual',
        signal: AbortSignal.timeout(
          options.timeoutMs ?? PARITY_FETCH_TIMEOUT_MS
        ),
      });
      if (
        response.url &&
        new URL(response.url).origin !== options.expectedOrigin
      ) {
        return null;
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirectCount === MAX_PARITY_REDIRECTS) return null;
        requestUrl = new URL(location, requestUrl).toString();
        continue;
      }

      return response.ok ? response : null;
    } catch (_error) {
      return null;
    }
  }

  return null;
}
