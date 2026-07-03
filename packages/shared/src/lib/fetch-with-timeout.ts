export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
export const DEFAULT_FETCH_TIMEOUT_MESSAGE =
  'Request timed out. Please try again.';

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMessage?: string;
  timeoutMs?: number;
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function composeAbortSignals(signals: AbortSignal[]): AbortSignal | undefined {
  const activeSignals = signals.filter(Boolean);
  if (activeSignals.length === 0) {
    return undefined;
  }
  if (activeSignals.length === 1) {
    return activeSignals[0];
  }

  const controller = new AbortController();
  for (const signal of activeSignals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
) {
  const {
    signal,
    timeoutMessage = DEFAULT_FETCH_TIMEOUT_MESSAGE,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  const signals = signal ? [controller.signal, signal] : [controller.signal];
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...fetchOptions,
      signal: composeAbortSignals(signals),
    });
  } catch (error) {
    if (isAbortError(error) && timedOut) {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
