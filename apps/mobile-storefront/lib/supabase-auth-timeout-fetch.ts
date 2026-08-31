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

function isAmbiguousRefreshResponse(response: Response): boolean {
  return response.status >= 500 && response.status <= 599;
}

async function fetchBufferedBeforeDeadline(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response | null> {
  const controller = new AbortController();
  const callerSignal = init?.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  if (callerSignal?.aborted) abortFromCaller();
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
    callerSignal?.removeEventListener('abort', abortFromCaller);
    if (timer) clearTimeout(timer);
  }
}

type RefreshAttempts = {
  canRecover: boolean;
  firstInit: RequestInit | undefined;
  firstInput: RequestInfo | URL;
  recoveryInit: RequestInit | undefined;
  recoveryInput: RequestInfo | URL;
};

function prepareRefreshAttempts(
  input: RequestInfo | URL,
  init: RequestInit | undefined
): RefreshAttempts {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    try {
      const request = new Request(input, init);
      return {
        canRecover: true,
        firstInit: undefined,
        firstInput: request.clone(),
        recoveryInit: undefined,
        recoveryInput: request.clone(),
      };
    } catch {
      return {
        canRecover: false,
        firstInit: init,
        firstInput: input,
        recoveryInit: undefined,
        recoveryInput: input,
      };
    }
  }

  const bodyIsStream =
    typeof ReadableStream !== 'undefined' &&
    init?.body instanceof ReadableStream;
  return {
    canRecover: !bodyIsStream,
    firstInit: init,
    firstInput: input,
    recoveryInit: init,
    recoveryInput: input,
  };
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

    const callerSignal =
      init?.signal ??
      (typeof Request !== 'undefined' && input instanceof Request
        ? input.signal
        : undefined);
    const attempts = prepareRefreshAttempts(input, init);

    let firstResponse: Response | null = null;
    try {
      firstResponse = await fetchBufferedBeforeDeadline(
        fetchImpl,
        attempts.firstInput,
        { ...attempts.firstInit, signal: callerSignal },
        timeoutMs
      );
    } catch (error) {
      if (callerSignal?.aborted || !attempts.canRecover) throw error;
      // A rejected request or body can still follow a provider-side token
      // rotation, so recover once under the same bounded deadline.
    }
    if (firstResponse && !isAmbiguousRefreshResponse(firstResponse)) {
      return firstResponse;
    }
    if (callerSignal?.aborted) {
      throw callerSignal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    if (!attempts.canRecover) return authRefreshTimedOutResponse();

    // A timed-out refresh may already have rotated the one-time token remotely.
    // Retry immediately while Supabase's refresh-token reuse window is open.
    try {
      const recoveryResponse = await fetchBufferedBeforeDeadline(
        fetchImpl,
        attempts.recoveryInput,
        { ...attempts.recoveryInit, signal: callerSignal },
        timeoutMs
      );
      if (recoveryResponse && !isAmbiguousRefreshResponse(recoveryResponse)) {
        return recoveryResponse;
      }
    } catch (error) {
      if (callerSignal?.aborted) throw error;
      // Normalize a second ambiguous failure so Auth does not start its own
      // long retry loop while holding the process lock.
    }
    return authRefreshTimedOutResponse();
  };
}
