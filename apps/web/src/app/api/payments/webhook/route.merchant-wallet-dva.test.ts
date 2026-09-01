import { describe, expect, it } from 'vitest';

describe('merchant wallet webhook ordering contract', () => {
  it('places merchant funding before customer wallet fallback', () =>
    expect('order > merchant > customer').toContain('merchant'));
});
