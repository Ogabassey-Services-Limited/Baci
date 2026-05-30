import {
  ApiError,
  NetworkError,
  RetryExhaustedError,
  TimeoutError,
} from '@/lib/api';
import { trackError } from '@/services/analytics';

export class OrderError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
    this.details = details;
  }
}

const ORDER_VALIDATION_ERROR_MESSAGES: Record<string, string> = {
  insufficient_stock:
    'This item is no longer available in the selected quantity. Please update your cart and try again.',
  insufficient_variant_stock:
    'This item is no longer available in the selected option. Please update your cart and try again.',
  invalid_items: 'One or more cart items are no longer available.',
  order_total_mismatch:
    'Your cart total changed. Please review your order and try again.',
  shipping_quote_required:
    'Delivery pricing changed. Please return to delivery and select a shipping option again.',
  tax_amount_mismatch:
    'Your order total changed. Please review your order and try again.',
};

export function readResponseString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function getValidationErrorMessage(
  error: string,
  details: unknown
): string {
  const detailCode = readResponseString(details);
  if (detailCode && ORDER_VALIDATION_ERROR_MESSAGES[detailCode]) {
    return ORDER_VALIDATION_ERROR_MESSAGES[detailCode];
  }

  return ORDER_VALIDATION_ERROR_MESSAGES[error] ?? error;
}

function normalizeConflictCode(value: unknown): string {
  const rawCode = readResponseString(value);
  if (!rawCode) return 'ORDER_CONFLICT';

  const normalizedCode = rawCode
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

  if (normalizedCode === 'ORDER_NOT_REUSABLE') {
    return 'CHECKOUT_ORDER_NOT_REUSABLE';
  }

  if (
    normalizedCode === 'CHECKOUT_ORDER_NOT_REUSABLE' ||
    normalizedCode === 'CHECKOUT_IDEMPOTENCY_CONFLICT'
  ) {
    return normalizedCode;
  }

  return normalizedCode;
}

export async function throwOrderHttpError(
  response: Response,
  startTime: number
): Promise<never> {
  const errorData = (await response.json().catch(() => ({}))) as {
    code?: unknown;
    details?: unknown;
    error?: unknown;
  };
  const errorMessage =
    readResponseString(errorData.error) ||
    `Order creation failed (${response.status})`;

  trackError('order_creation_failed', errorMessage, {
    status: response.status,
    duration_ms: Date.now() - startTime,
  });

  if (response.status === 400) {
    const details = errorData.details ?? errorData.code;
    throw new OrderError(
      getValidationErrorMessage(errorMessage, details),
      'VALIDATION_ERROR',
      details
    );
  }

  if (response.status === 401) {
    throw new OrderError('Session expired. Please sign in again.', 'AUTH_ERROR');
  }

  if (response.status === 404) {
    const notFoundMessage = /merchant not found/i.test(errorMessage)
      ? 'Checkout is temporarily unavailable for this store. Please try again later.'
      : errorMessage;
    throw new OrderError(notFoundMessage, 'NOT_FOUND');
  }

  if (response.status === 409) {
    const conflictCode = normalizeConflictCode(errorData.code);
    const conflictDetails =
      errorData.details ??
      (typeof errorData === 'object' && errorData !== null
        ? { ...errorData, code: conflictCode }
        : conflictCode);
    throw new OrderError(errorMessage, conflictCode, conflictDetails);
  }

  if (response.status >= 500) {
    throw new OrderError(
      'Server error. Please try again in a few moments.',
      'SERVER_ERROR'
    );
  }

  throw new OrderError(errorMessage, 'UNKNOWN_ERROR');
}

export function mapCreateOrderException(
  error: unknown,
  startTime: number
): OrderError {
  if (error instanceof OrderError) return error;

  if (error instanceof RetryExhaustedError) {
    trackError('order_creation_retry_exhausted', error.message, {
      attempts: error.attempts,
      lastError: error.lastError.message,
      duration_ms: Date.now() - startTime,
    });
    return new OrderError(
      'Unable to complete order after multiple attempts. Please try again later.',
      'RETRY_EXHAUSTED'
    );
  }

  if (error instanceof TimeoutError) {
    trackError('order_creation_timeout', error.message, {
      duration_ms: Date.now() - startTime,
    });
    return new OrderError(
      'Request timed out. Please check your connection and try again.',
      'TIMEOUT_ERROR'
    );
  }

  if (error instanceof NetworkError) {
    trackError('order_creation_network_error', error.message, {
      duration_ms: Date.now() - startTime,
    });
    return new OrderError(
      'Network error. Please check your connection and try again.',
      'NETWORK_ERROR'
    );
  }

  if (error instanceof ApiError) {
    trackError('order_creation_api_error', error.message, {
      status: error.status,
      duration_ms: Date.now() - startTime,
    });
    return new OrderError(
      'Server error. Please try again in a few moments.',
      'SERVER_ERROR'
    );
  }

  if (error instanceof TypeError && error.message.includes('Network')) {
    trackError('order_creation_network_error', error.message, {
      duration_ms: Date.now() - startTime,
    });
    return new OrderError(
      'Network error. Please check your connection and try again.',
      'NETWORK_ERROR'
    );
  }

  trackError(
    'order_creation_exception',
    error instanceof Error ? error.message : 'Unknown error',
    { duration_ms: Date.now() - startTime }
  );
  return new OrderError(
    'Something went wrong. Please try again.',
    'UNKNOWN_ERROR',
    error
  );
}
