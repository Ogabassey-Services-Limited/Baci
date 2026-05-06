const ROOT_TOKEN_FIELD_PRIORITY = [
  'pin',
  'Pin',
  'PIN',
  'token',
  'Token',
  'meterToken',
  'MeterToken',
  'vendCode',
  'VendCode',
  'voucher',
  'Voucher',
] as const;

const TOKEN_ROOT_KEYS = new Set([
  'pin',
  'token',
  'metertoken',
  'vendcode',
  'voucher',
  'vouchercode',
  'voucherpin',
  'billtoken',
]);

const TOKEN_CONTAINER_KEYS = new Set([
  ...TOKEN_ROOT_KEYS,
  'pins',
  'tokens',
  'tokenlist',
  'tokendetails',
  'voucherdetails',
  'vouchers',
  'voucherpins',
  'billtokens',
  'venddetails',
  'venddata',
]);

const TOKEN_DETAIL_FIELD_PRIORITY = [
  'number',
  'Number',
  'code',
  'Code',
  'value',
  'Value',
  ...ROOT_TOKEN_FIELD_PRIORITY,
] as const;

const TOKEN_DETAIL_KEYS = new Set([
  ...TOKEN_ROOT_KEYS,
  'number',
  'code',
  'value',
  'tokencode',
  'tokennumber',
  'tokenvalue',
  'vendtoken',
  'credittoken',
  'generatedtoken',
  'generatedtokencode',
]);

const MAX_TOKEN_EXTRACTION_DEPTH = 8;

export type KudaVoucherTokenField =
  | number
  | string
  | Record<string, unknown>
  | readonly unknown[]
  | null
  | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeKudaString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function extractFromTokenValue(
  value: unknown,
  depth = 0,
  visited = new WeakSet<object>()
): string | undefined {
  if (depth >= MAX_TOKEN_EXTRACTION_DEPTH) {
    return undefined;
  }

  const scalar = normalizeKudaString(value);
  if (scalar) {
    return scalar;
  }

  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return undefined;
    }

    visited.add(value);

    for (const item of value) {
      const token = extractFromTokenValue(item, depth + 1, visited);
      if (token) {
        return token;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (visited.has(value)) {
    return undefined;
  }

  visited.add(value);

  for (const key of TOKEN_DETAIL_FIELD_PRIORITY) {
    if (Object.hasOwn(value, key)) {
      const token = extractFromTokenValue(value[key], depth + 1, visited);
      if (token) {
        return token;
      }
    }
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (TOKEN_DETAIL_KEYS.has(normalizeKey(key))) {
      const token = extractFromTokenValue(nestedValue, depth + 1, visited);
      if (token) {
        return token;
      }
    }
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue) || isRecord(nestedValue)) {
      const token = extractFromTokenValue(nestedValue, depth + 1, visited);
      if (token) {
        return token;
      }
    }
  }

  return undefined;
}

export function extractKudaVoucherPin(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined;
  }

  const visited = new WeakSet<object>();
  visited.add(data);

  for (const key of ROOT_TOKEN_FIELD_PRIORITY) {
    if (Object.hasOwn(data, key)) {
      const token = extractFromTokenValue(data[key], 1, visited);
      if (token) {
        return token;
      }
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (TOKEN_CONTAINER_KEYS.has(normalizeKey(key))) {
      const token = extractFromTokenValue(value, 1, visited);
      if (token) {
        return token;
      }
    }
  }

  return undefined;
}
