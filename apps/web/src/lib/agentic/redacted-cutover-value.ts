export interface RedactedCutoverValue<T> {
  toJSON(): '[REDACTED]';
  unwrap(): T;
}

export function redactCutoverValue<T>(value: T): RedactedCutoverValue<T> {
  return Object.freeze({
    toJSON: () => '[REDACTED]' as const,
    unwrap: () => value,
  });
}
