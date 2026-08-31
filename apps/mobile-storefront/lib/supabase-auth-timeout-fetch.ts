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
      status: 408,
    }
  );
}

async function fetchBufferedBeforeDeadline(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  const request = fetchImpl(input, { ...init, signal: controller.signal }).then(
    async (response) => {
      await response.clone().arrayBuffer();
      return response;
    }
  );

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

    const firstResponse = await fetchBufferedBeforeDeadline(
      fetchImpl,
      input,
      init,
      timeoutMs
    );
    if (firstResponse) return firstResponse;

    // A timed-out refresh may already have rotated the one-time token remotely.
    // Retry immediately while Supabase's refresh-token reuse window is open.
    const recoveryResponse = await fetchBufferedBeforeDeadline(
      fetchImpl,
      input,
      init,
      timeoutMs
    );
    return recoveryResponse ?? authRefreshTimedOutResponse();
  };
}
