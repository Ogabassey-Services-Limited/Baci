import { describe, expect, it } from 'vitest';
import { StorefrontWrapper } from './storefront-wrapper';

describe('StorefrontWrapper', () => {
  it('exports a valid component', () => {
    expect(StorefrontWrapper).toBeDefined();
    expect(typeof StorefrontWrapper).toBe('function');
  });
});
