import { describe, expect, it } from 'vitest';
import { VariantBuilder } from './variant-builder';

describe('VariantBuilder', () => {
  it('exports a valid component', () => {
    expect(VariantBuilder).toBeDefined();
    expect(typeof VariantBuilder).toBe('function');
  });
});
