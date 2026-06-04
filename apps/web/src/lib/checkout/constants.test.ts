import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSURANCE_RATE } from './constants';

describe('checkout constants', () => {
  it('exports the default assurance rate', () => {
    expect(DEFAULT_ASSURANCE_RATE).toBe(0.05);
  });
});
