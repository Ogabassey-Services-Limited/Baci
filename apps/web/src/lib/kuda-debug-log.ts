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
  const value = process.env.KUDA_BILL_DEBUG?.trim().toLowerCase();
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
  if (depth > 7) {
    return '[MAX_DEPTH]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactKudaDebugPayload(item, depth + 1));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((payload, [key, nestedValue]) => {
    payload[key] = shouldRedactKudaDebugValue(key, nestedValue)
      ? getDebugValueShape(nestedValue)
      : redactKudaDebugPayload(nestedValue, depth + 1);
    return payload;
  }, {});
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

  logger.info({
    message: 'Kuda raw response received',
    requestData: redactKudaDebugPayload(requestData),
    requestRef,
    rawResponse: redactKudaDebugPayload(raw),
    serviceType,
  });
}
