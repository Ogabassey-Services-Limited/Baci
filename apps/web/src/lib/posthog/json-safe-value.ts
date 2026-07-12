const MAX_SERIALIZED_VALUE_LENGTH = 32_000;
const TRUNCATED_VALUE = '[Telemetry value truncated]';

/** Normalizes telemetry values so one unsupported field cannot break persistence. */
export function toJsonSafePostHogValue(value: unknown): unknown {
  const ancestors: object[] = [];

  try {
    const serialized = JSON.stringify(
      value,
      function (this: object, _key, currentValue: unknown) {
        if (typeof currentValue === 'bigint') {
          return currentValue.toString();
        }
        if (typeof currentValue === 'undefined') {
          return null;
        }
        if (
          typeof currentValue === 'function' ||
          typeof currentValue === 'symbol'
        ) {
          return String(currentValue);
        }
        let normalizedValue = currentValue;
        if (currentValue instanceof Error) {
          normalizedValue = {
            message: currentValue.message,
            name: currentValue.name,
            stack: currentValue.stack,
          };
        }
        if (typeof normalizedValue === 'object' && normalizedValue !== null) {
          while (
            ancestors.length > 0 &&
            ancestors[ancestors.length - 1] !== this
          ) {
            ancestors.pop();
          }
          if (ancestors.includes(normalizedValue)) {
            return '[Circular]';
          }
          ancestors.push(normalizedValue);
        }
        return normalizedValue;
      }
    );

    if (serialized === undefined) {
      return null;
    }
    if (serialized.length > MAX_SERIALIZED_VALUE_LENGTH) {
      return TRUNCATED_VALUE;
    }
    return JSON.parse(serialized);
  } catch {
    return String(value);
  }
}
