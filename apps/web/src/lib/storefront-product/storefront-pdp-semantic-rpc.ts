import { logger } from '@/lib/logger';

type AbortableQuery<T> = PromiseLike<T> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<T>;
};

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

/** Runs one bounded PDP semantic RPC and traces only slow/failed boundaries. */
export async function runStorefrontPdpSemanticRpc<T>(
  query: AbortableQuery<T>,
  options: { deadlineMs: number; traceThresholdMs: number }
) {
  const timeoutSignal = AbortSignal.timeout(options.deadlineMs);
  const boundedQuery =
    typeof query.abortSignal === 'function'
      ? query.abortSignal(timeoutSignal)
      : query;
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
    response = await boundedQuery;
  } catch (error) {
    trace({
      errorCode: readStringField(error, 'code'),
      errorName: readStringField(error, 'name'),
      outcome: 'throw',
    });
    throw error;
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
