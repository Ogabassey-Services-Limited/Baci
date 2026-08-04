import { describe, expect, it } from 'vitest';
import { getProductModelIdentifiersFromSources } from './get-product-model-identifiers-from-sources';

describe('getProductModelIdentifiersFromSources', () => {
  it('falls back to a paired slug when the product name has no model', () => {
    const identifiers = getProductModelIdentifiersFromSources(
      ['Samsung Smartphone'],
      ['samsung-galaxy-s25'],
      (source) => (source.includes('s25') ? 's25' : undefined)
    );

    expect(identifiers).toEqual(['s25']);
  });
});
