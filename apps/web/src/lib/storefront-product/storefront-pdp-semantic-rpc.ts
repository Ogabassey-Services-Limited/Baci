import { logger } from '@/lib/logger';

export type AbortableQuery<T> = PromiseLike<T> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<T>;
  retry?: (shouldRetry: boolean) => PromiseLike<T>;
};

export interface StorefrontPdpSemanticRpcOptions {
  deadlineMs: number;
  traceThresholdMs: number;
}

type BoundaryTrace = {
  elapsedMs: number;
  errorCode?: string;
  errorName?: string;
  outcome: 'slow_response' | 'throw' | 'timeout_response';
  responseStatus?: number;
};

function readStringField(value: unknown, field: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const fieldValue = Reflect.get(value, field);
  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

function readNumberField(value: unknown, field: string): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const fieldValue = Reflect.get(value, field);
  return typeof fieldValue === 'number' ? fieldValue : undefined;
}

function createAbortDeadlinePromise(signal: AbortSignal) {
  let cleanup: () => void = () => undefined;
  const promise = new Promise<never>((_, reject) => {
    const onAbort = () => {
      cleanup();
      reject(
        signal.reason ??
          new DOMException(
            'The operation was aborted due to timeout',
            'TimeoutError'
          )
      );
    };

    cleanup = () => signal.removeEventListener('abort', onAbort);
    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });

  return { cleanup, promise };
}

/** Runs one bounded PDP semantic RPC and traces only slow/failed boundaries. */
export async function runStorefrontPdpSemanticRpc<T>(
  query: AbortableQuery<T>,
  options: StorefrontPdpSemanticRpcOptions
) {
  const timeoutSignal = AbortSignal.timeout(options.deadlineMs);
  const boundedQuery =
    typeof query.abortSignal === 'function'
      ? query.abortSignal(timeoutSignal)
      : query;
  // AbortSignal.timeout() rejects with a native `TimeoutError`. The installed
  // PostgREST client only suppresses automatic retries for `AbortError`, so a
  // timed-out optional read can otherwise fan out into four attempts. Keep the
  // read to one attempt; the guard preserves compatibility with test doubles
  // and thenables that do not expose PostgREST's retry builder method.
  const boundedQueryWithRetry = boundedQuery as AbortableQuery<T>;
  const singleAttemptQuery =
    typeof boundedQueryWithRetry.retry === 'function'
      ? boundedQueryWithRetry.retry(false)
      : boundedQuery;
  const deadline = createAbortDeadlinePromise(timeoutSignal);
  const startedAt = performance.now();
  const trace = (fields: Omit<BoundaryTrace, 'elapsedMs'>) => {
    logger.warn({
      message: 'Storefront PDP semantic RPC boundary trace',
      operation: 'pdp_semantic_enrichment',
      ...fields,
      elapsedMs: Math.round(performance.now() - startedAt),
      deadlineMs: options.deadlineMs,
      timeoutSignalAborted: timeoutSignal.aborted,
    });
  };

  let response: T;
  try {
    // Some fetch implementations resolve an aborted PostgREST request well
    // after the signal fires. Race the response as well as aborting the
    // transport so the optional PDP work cannot extend the route deadline.
    response = await Promise.race([singleAttemptQuery, deadline.promise]);
  } catch (error) {
    trace({
      errorCode: readStringField(error, 'code'),
      errorName: readStringField(error, 'name'),
      outcome: 'throw',
    });
    throw error;
  } finally {
    deadline.cleanup();
  }

  const elapsedMs = performance.now() - startedAt;
  const responseError =
    response && typeof response === 'object'
      ? Reflect.get(response, 'error')
      : null;
  if (elapsedMs >= options.traceThresholdMs && !responseError) {
    trace({
      outcome: 'slow_response',
      responseStatus: readNumberField(response, 'status'),
    });
  }

  return {
    response,
    trace,
  };
}
