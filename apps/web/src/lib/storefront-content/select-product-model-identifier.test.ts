import { describe, expect, it } from 'vitest';
import { selectProductModelIdentifier } from './select-product-model-identifier';

describe('selectProductModelIdentifier', () => {
  it('retains the product line before an alphanumeric model', () => {
    const identifier = selectProductModelIdentifier(['spectre', 'x360']);

    expect(identifier).toBe('spectre x360');
  });

  it('retains all numeric tokens for convertible models', () => {
    const identifier = selectProductModelIdentifier([
      'dell',
      '14',
      'plus',
      '2',
      'in',
      '1',
    ]);

    expect(identifier).toBe('dell 14 plus 2 in 1');
  });

  it('preserves a model family phrase for single-letter series models', () => {
    const identifier = selectProductModelIdentifier(['series', 's']);

    expect(identifier).toBe('series s');
  });
});
