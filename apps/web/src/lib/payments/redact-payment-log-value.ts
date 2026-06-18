const REDACTED_PAYMENT_LOG_VALUE = '[REDACTED]';

const SENSITIVE_PAYMENT_LOG_KEYS = new Set([
  'address',
  'billing_address',
  'city',
  'customer_email',
  'customer_name',
  'customer_phone',
  'email',
  'first_name',
  'formatted_phone',
  'last_name',
  'line1',
  'line2',
  'mobile_number',
  'name',
  'original_phone',
  'phone',
  'phone_number',
  'postal_code',
  'state',
  'zip_code',
]);

function normalizePaymentLogKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function shouldRedactPaymentLogKey(key: string): boolean {
  const normalizedKey = normalizePaymentLogKey(key);
  return (
    SENSITIVE_PAYMENT_LOG_KEYS.has(normalizedKey) ||
    normalizedKey.endsWith('_email') ||
    normalizedKey.endsWith('_phone') ||
    normalizedKey.endsWith('_phone_number')
  );
}

function redactPaymentLogRecord(
  record: Record<string, unknown>,
  seen: WeakSet<object>
): Record<string, unknown> {
  if (seen.has(record)) {
    return { circular: true };
  }

  seen.add(record);

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      shouldRedactPaymentLogKey(key)
        ? REDACTED_PAYMENT_LOG_VALUE
        : redactPaymentLogValueInternal(value, seen),
    ])
  );
}

function redactPaymentLogValueInternal(
  value: unknown,
  seen: WeakSet<object>
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactPaymentLogValueInternal(item, seen));
  }

  if (value && typeof value === 'object') {
    return redactPaymentLogRecord(value as Record<string, unknown>, seen);
  }

  return value;
}

export function redactPaymentLogValue(value: unknown): unknown {
  return redactPaymentLogValueInternal(value, new WeakSet<object>());
}
