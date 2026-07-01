export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function readString(
  sources: readonly JsonRecord[],
  keys: readonly string[]
) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
}

export function readNumber(
  sources: readonly JsonRecord[],
  keys: readonly string[]
) {
  return readNumberAtLeast(sources, keys, false);
}

/** Reads a finite amount that may intentionally be zero. */
export function readNonNegativeNumber(
  sources: readonly JsonRecord[],
  keys: readonly string[]
) {
  return readNumberAtLeast(sources, keys, true);
}

function readNumberAtLeast(
  sources: readonly JsonRecord[],
  keys: readonly string[],
  inclusive: boolean
) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      const parsed =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim().length > 0
            ? Number(value)
            : Number.NaN;
      const isInRange = inclusive ? parsed >= 0 : parsed > 0;
      if (Number.isFinite(parsed) && isInRange) {
        return parsed;
      }
    }
  }

  return null;
}

export function readBoolean(
  sources: readonly JsonRecord[],
  keys: readonly string[]
) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'boolean') {
        return value;
      }
    }
  }

  return null;
}
