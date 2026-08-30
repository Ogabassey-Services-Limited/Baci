const AUTH_REFRESH_TIMEOUT_MS = 4_000;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function authRefreshTimedOutResponse(): Response {
  return new Response(
    JSON.stringify({
      code: 'request_timeout',
      message: 'Auth refresh request timed out',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    }
  );
}

export function createSupabaseAuthTimeoutFetch(
  fetchImpl: typeof fetch,
  timeoutMs = AUTH_REFRESH_TIMEOUT_MS
): typeof fetch {
  return async (input, init) => {
    const url = requestUrl(input);
    if (!url.includes('/auth/v1/token?grant_type=refresh_token')) {
      return fetchImpl(input, init);
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<Response>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(authRefreshTimedOutResponse());
      }, timeoutMs);
    });
    const request = fetchImpl(input, { ...init, signal: controller.signal });

    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
