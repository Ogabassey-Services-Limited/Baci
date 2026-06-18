import { describe, expect, it } from 'vitest';
import { sanitizePostHogException } from './exception-sanitizer';

const REDACTED_VALUE = '[Filtered]';

describe('sanitizePostHogException', () => {
  it('clones errors and redacts message, stack, and nested cause payloads', () => {
    const error = new Error(
      'provider failed for buyer@example.com at https://pay.example/callback?token=raw_secret&reference=ref_1234567 phone=08012345678 body={"token":"json_secret","trackingToken":"track_secret"}'
    );
    error.stack =
      'Error: token=raw_secret reference=ref_1234567 buyer@example.com phone=08012345678';
    Object.defineProperty(error, 'cause', {
      configurable: true,
      value: {
        token: 'cause_secret',
        nested: {
          authorization: 'Bearer nested_secret',
          note: 'reference=ref_1234567 buyer@example.com',
        },
      },
    });

    const sanitized = sanitizePostHogException(error) as Error & {
      cause?: Record<string, unknown>;
    };

    expect(sanitized).toBeInstanceOf(Error);
    expect(sanitized).not.toBe(error);
    expect(sanitized.message).toContain(REDACTED_VALUE);
    expect(sanitized.message).not.toContain('buyer@example.com');
    expect(sanitized.message).not.toContain('raw_secret');
    expect(sanitized.message).not.toContain('ref_1234567');
    expect(sanitized.message).not.toContain('json_secret');
    expect(sanitized.message).not.toContain('track_secret');
    expect(sanitized.message).not.toContain('08012345678');
    expect(sanitized.stack).not.toContain('buyer@example.com');
    expect(sanitized.stack).not.toContain('raw_secret');
    expect(sanitized.cause).toEqual({
      token: REDACTED_VALUE,
      nested: {
        authorization: REDACTED_VALUE,
        note: `reference=${REDACTED_VALUE} ${REDACTED_VALUE}`,
      },
    });
  });

  it('handles circular object and array causes without recursion overflow', () => {
    const circularArray: unknown[] = [];
    circularArray.push(circularArray);
    const circularObject: Record<string, unknown> = {
      token: 'cause_secret',
      nested: circularArray,
    };
    circularArray.push(circularObject);
    const error = new Error('provider failed');
    Object.defineProperty(error, 'cause', {
      configurable: true,
      value: circularObject,
    });

    const sanitized = sanitizePostHogException(error) as Error & {
      cause?: Record<string, unknown>;
    };

    expect(sanitized.cause).toEqual({
      token: REDACTED_VALUE,
      nested: ['[Circular]', '[Circular]'],
    });
  });
});
