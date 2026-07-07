import { describe, expect, it } from 'vitest';
import { checkRateLimit } from './provider';

describe('checkRateLimit', () => {
  const config = { requests: 3, windowMs: 60_000 };

  it('allows the first request in a fresh window and reports remaining', () => {
    const result = checkRateLimit(`fresh-${Math.random()}`, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it('decrements remaining across requests and blocks once the limit is hit', () => {
    const id = `burst-${Math.random()}`;
    expect(checkRateLimit(id, config).remaining).toBe(2);
    expect(checkRateLimit(id, config).remaining).toBe(1);
    expect(checkRateLimit(id, config).remaining).toBe(0);

    const blocked = checkRateLimit(id, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetIn).toBeGreaterThan(0);
  });

  it('tracks separate identifiers independently', () => {
    const a = `id-a-${Math.random()}`;
    const b = `id-b-${Math.random()}`;
    checkRateLimit(a, config);
    checkRateLimit(a, config);
    // b is untouched by a's usage.
    expect(checkRateLimit(b, config).remaining).toBe(2);
  });
});
