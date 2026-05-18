import { describe, expect, it } from 'vitest';
import { normalizeEnvBoolean } from '@/lib/env-boolean';

describe('normalizeEnvBoolean', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    [' true ', true],
    ['1', true],
    ['yes', true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['', undefined],
    [undefined, undefined],
    ['maybe', undefined],
  ])('normalizes %s to %s', (value, expected) => {
    expect(normalizeEnvBoolean(value)).toBe(expected);
  });
});
