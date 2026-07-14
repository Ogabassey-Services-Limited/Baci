export type DeliveryFailureOutcome =
  | 'dead_letter'
  | 'delivery_unknown'
  | 'retry';

type DeliveryFailure = {
  attempt: number;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
  maxAttempts: number;
  requestMayHaveBeenSent?: boolean;
};

const PERMANENT_CODES = new Set([
  'destination_not_configured',
  'invalid_destination_credentials',
  'invalid_destination_payload',
  'invalid_order_total',
  'missing_immutable_data',
  'paid_order_not_deliverable',
  'unsupported_event',
]);

export function classifyDeliveryFailure(
  failure: DeliveryFailure
): DeliveryFailureOutcome {
  if (failure.requestMayHaveBeenSent) return 'delivery_unknown';
  if (failure.attempt >= failure.maxAttempts) return 'dead_letter';
  if (failure.errorCode && PERMANENT_CODES.has(failure.errorCode)) {
    return 'dead_letter';
  }

  const status = failure.httpStatus;
  if (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status && status >= 500)
  ) {
    return 'retry';
  }
  if (status && status >= 400) return 'dead_letter';

  const message = failure.errorMessage?.toLowerCase() ?? '';
  if (/abort|timed?\s*out|timeout/.test(message)) return 'delivery_unknown';
  if (/dns|econn|network|socket/.test(message)) return 'retry';
  return 'retry';
}
