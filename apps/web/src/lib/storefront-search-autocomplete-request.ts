import {
  POSTGRES_QUERY_CANCELED_CODE,
  withAutocompleteInFlightDeadline,
} from './storefront-search-autocomplete-in-flight';

export async function runBoundedAutocompleteRequest<T>({
  cacheKey,
  createSaturationError,
  inFlight,
  maxEntries,
  onSuccess,
  operation,
  timeoutMs,
}: {
  cacheKey: string;
  createSaturationError: () => Error;
  inFlight: Map<string, Promise<T>>;
  maxEntries: number;
  onSuccess: (response: T) => void;
  operation: (signal: AbortSignal) => Promise<T>;
  timeoutMs: number;
}): Promise<T> {
  const existingRequest = inFlight.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }
  if (inFlight.size >= maxEntries) {
    throw createSaturationError();
  }

  let request: Promise<T>;
  request = withAutocompleteInFlightDeadline(operation, timeoutMs, () => {
    if (inFlight.get(cacheKey) === request) {
      inFlight.delete(cacheKey);
    }
  });
  inFlight.set(cacheKey, request);

  let retainSlotUntilOperationSettles = false;
  try {
    const response = await request;
    onSuccess(response);
    return response;
  } catch (error) {
    retainSlotUntilOperationSettles =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === POSTGRES_QUERY_CANCELED_CODE;
    throw error;
  } finally {
    if (
      !retainSlotUntilOperationSettles &&
      inFlight.get(cacheKey) === request
    ) {
      inFlight.delete(cacheKey);
    }
  }
}
