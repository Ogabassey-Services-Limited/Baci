import { getKudaBillDebug } from '@/env';
import { logger } from '@/lib/logger';

const KUDA_RAW_DEBUG_SERVICE_TYPES = new Set([
  'ADMIN_PURCHASE_BILL',
  'BILL_TSQ',
]);

const KUDA_RAW_DEBUG_REDACT_KEYS = new Set([
  'apikey',
  'authorization',
  'billtoken',
  'customerfirstname',
  'customeridentifier',
  'email',
  'metertoken',
  'phone',
  'phonenumber',
  'pin',
  'token',
  'vendcode',
  'voucher',
  'vouchercode',
  'voucherpin',
]);

function normalizeKudaDebugKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isKudaBillDebugEnabled() {
  const value = getKudaBillDebug()?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function getDebugValueShape(value: unknown) {
  if (Array.isArray(value)) {
    return {
      redacted: true,
      type: 'array',
      length: value.length,
    };
  }

  if (value && typeof value === 'object') {
    return {
      redacted: true,
      type: 'object',
      keys: Object.keys(value as Record<string, unknown>).slice(0, 25),
    };
  }

  return {
    redacted: true,
    type: value === null ? 'null' : typeof value,
    length: typeof value === 'string' ? value.length : undefined,
  };
}

function shouldRedactKudaDebugValue(key: string, value: unknown) {
  if (KUDA_RAW_DEBUG_REDACT_KEYS.has(normalizeKudaDebugKey(key))) {
    return true;
  }

  return typeof value === 'string' && /^\+?\d[\d\s-]{7,}$/.test(value.trim());
}

export function redactKudaDebugPayload(value: unknown, depth = 0): unknown {
  return redactKudaDebugValue(value, depth, new WeakSet<object>());
}

function redactKudaDebugValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (depth > 7) {
    return '[MAX_DEPTH]';
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    return value.map((item) => redactKudaDebugValue(item, depth + 1, seen));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((payload, [key, nestedValue]) => {
    payload[key] = shouldRedactKudaDebugValue(key, nestedValue)
      ? getDebugValueShape(nestedValue)
      : redactKudaDebugValue(nestedValue, depth + 1, seen);
    return payload;
  }, {});
}

function safeSerialize(value: unknown) {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (typeof nestedValue === 'bigint') {
        return nestedValue.toString();
      }

      if (nestedValue && typeof nestedValue === 'object') {
        if (seen.has(nestedValue)) {
          return '[Circular]';
        }
        seen.add(nestedValue);
      }

      return nestedValue;
    });
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      serializationFailed: true,
    });
  }
}

export function logKudaRawResponse({
  raw,
  requestData,
  requestRef,
  serviceType,
}: {
  raw: unknown;
  requestData: Record<string, unknown>;
  requestRef: string;
  serviceType: string;
}) {
  if (
    !isKudaBillDebugEnabled() ||
    !KUDA_RAW_DEBUG_SERVICE_TYPES.has(serviceType)
  ) {
    return;
  }

  const redactedRequestData = redactKudaDebugPayload(requestData);
  const redactedRawResponse = redactKudaDebugPayload(raw);

  logger.info({
    message: 'Kuda raw response received',
    requestData: redactedRequestData,
    requestDataJson: safeSerialize(redactedRequestData),
    requestRef,
    rawResponse: redactedRawResponse,
    rawResponseJson: safeSerialize(redactedRawResponse),
    serviceType,
  });
}
