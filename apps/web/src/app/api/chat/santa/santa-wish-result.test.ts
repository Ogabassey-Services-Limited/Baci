import { describe, expect, it } from 'vitest';
import { parseWishResult } from './santa-wish-result';

describe('parseWishResult', () => {
  it('parses an approved wish and negotiated price', () => {
    expect(
      parseWishResult('ACTION:ADD_TO_CART|PRODUCT:Phone|PRICE:₦450,000')
    ).toEqual({
      type: 'wish_granted',
      productName: 'Phone',
      approvedPrice: 450000,
    });
  });
});
