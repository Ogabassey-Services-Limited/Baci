import { describe, expect, it } from 'vitest';
import { classifyBumpaProductProfile } from './bumpa-product-taxonomy';

describe('classifyBumpaProductProfile', () => {
  it('classifies product kind and brand family', () => {
    expect(classifyBumpaProductProfile('Delivery')).toMatchObject({
      productKind: 'delivery_fee',
    });
    expect(classifyBumpaProductProfile('Redmi Note 13')).toMatchObject({
      brand: 'Xiaomi',
      family: 'Redmi',
    });
    expect(classifyBumpaProductProfile('Xiaomi 14')).toMatchObject({
      brand: 'Xiaomi',
      family: 'Xiaomi',
    });
  });
});
