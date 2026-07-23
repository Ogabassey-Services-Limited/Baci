import { describe, expect, it } from 'vitest';
import { redactCutoverValue } from './redacted-cutover-value';

describe('redactCutoverValue', () => {
  it('requires explicit unwrap and redacts default JSON serialization', () => {
    const sensitive = { email: 'buyer@example.com' };
    const wrapped = redactCutoverValue(sensitive);

    expect(wrapped.unwrap()).toBe(sensitive);
    expect(JSON.stringify(wrapped)).toBe('"[REDACTED]"');
    expect(JSON.stringify(wrapped)).not.toContain(sensitive.email);
  });

  it.each([
    null,
    'secret',
    { nested: { token: 'secret-token' } },
  ])('redacts supported value %# while preserving explicit unwrap', (sensitive) => {
    const wrapped = redactCutoverValue(sensitive);

    expect(wrapped.unwrap()).toBe(sensitive);
    expect(JSON.stringify(wrapped)).toBe('"[REDACTED]"');
    expect(JSON.stringify(wrapped)).not.toContain('secret');
  });
});
