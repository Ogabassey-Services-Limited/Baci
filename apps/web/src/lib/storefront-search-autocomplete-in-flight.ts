export const POSTGRES_QUERY_CANCELED_CODE = '57014';

function createAutocompleteInFlightTimeoutError() {
  const error = new Error('Autocomplete request timed out');
  error.name = 'AutocompleteInFlightTimeoutError';
  return Object.assign(error, { code: POSTGRES_QUERY_CANCELED_CODE });
}

/**
 * Gives a coalesced autocomplete lookup one total budget and guarantees that
 * its caller settles even if the underlying transport does not cooperate.
 */
export function withAutocompleteInFlightDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  onOperationSettled?: () => void
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(createAutocompleteInFlightTimeoutError());
      controller.abort();
    }, timeoutMs);
  });

  let request: Promise<T>;
  try {
    request = Promise.resolve(operation(controller.signal));
  } catch (error) {
    request = Promise.reject(error);
  }
  // A deadline can win the race before a non-cooperative transport settles.
  // Keep a late rejection explicitly handled and report the transport's actual
  // settlement separately so callers do not release capacity on timeout alone.
  if (onOperationSettled) {
    void request
      .then(onOperationSettled, onOperationSettled)
      .catch(() => undefined);
  } else {
    request.catch(() => undefined);
  }

  return Promise.race([request, deadline]).finally(() => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  });
}
