import { describe, expect, it } from 'vitest';
import { ProductEmbedPicker } from './product-embed';

describe('ProductEmbedPicker', () => {
  it('exports a valid component', () => {
    expect(ProductEmbedPicker).toBeDefined();
    expect(typeof ProductEmbedPicker).toBe('function');
  });
});
