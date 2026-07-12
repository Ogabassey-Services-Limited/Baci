import { describe, expect, it } from 'vitest';
import { toJsonSafePostHogValue } from './json-safe-value';

describe('toJsonSafePostHogValue', () => {
  it('normalizes bigint, functions, and undefined nested values', () => {
    expect(
      toJsonSafePostHogValue({
        count: 2n,
        missing: undefined,
        callback: () => undefined,
      })
    ).toEqual({
      count: '2',
      missing: null,
      callback: expect.any(String),
    });
  });

  it('replaces circular references with a serializable marker', () => {
    const value: Record<string, unknown> = {};
    value.self = value;

    expect(toJsonSafePostHogValue(value)).toEqual({ self: '[Circular]' });
  });

  it('preserves repeated sibling references that are not cycles', () => {
    const shared = { value: 'same object' };

    expect(toJsonSafePostHogValue({ first: shared, second: shared })).toEqual({
      first: shared,
      second: shared,
    });
  });

  it('serializes nested errors without losing their message', () => {
    expect(
      toJsonSafePostHogValue({ error: new Error('chunk unavailable') })
    ).toMatchObject({
      error: { message: 'chunk unavailable', name: 'Error' },
    });
  });

  it('bounds oversized serialized telemetry values', () => {
    expect(toJsonSafePostHogValue({ value: 'x'.repeat(40_000) })).toBe(
      '[Telemetry value truncated]'
    );
  });
});
