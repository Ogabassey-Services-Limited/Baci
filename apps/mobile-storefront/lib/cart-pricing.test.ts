import {
  getCartItemEffectivePrice,
  hasActiveNegotiatedPrice,
} from './cart-pricing';

describe('cart-pricing', () => {
  it('uses accepted negotiated prices for negotiable items', () => {
    const item = {
      name: 'MacBook Air M1',
      price: 690000,
      negotiatedPrice: 676200,
      negotiationStatus: 'accepted' as const,
    };

    expect(hasActiveNegotiatedPrice(item)).toBe(true);
    expect(getCartItemEffectivePrice(item)).toBe(676200);
  });

  it('falls back to base price when negotiation is not accepted', () => {
    const item = {
      name: 'MacBook Air M1',
      price: 690000,
      negotiatedPrice: 676200,
      negotiationStatus: 'pending' as const,
    };

    expect(hasActiveNegotiatedPrice(item)).toBe(false);
    expect(getCartItemEffectivePrice(item)).toBe(690000);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative', -1],
    ['above base price', 700000],
  ])('falls back to base price for %s negotiated values', (_label, negotiatedPrice) => {
    const item = {
      name: 'MacBook Air M1',
      price: 690000,
      negotiatedPrice,
      negotiationStatus: 'accepted' as const,
    };

    expect(hasActiveNegotiatedPrice(item)).toBe(false);
    expect(getCartItemEffectivePrice(item)).toBe(690000);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative', -1],
  ])('falls back to zero for invalid %s base prices', (_label, price) => {
    const item = {
      name: 'MacBook Air M1',
      price,
      negotiatedPrice: 10,
      negotiationStatus: 'accepted' as const,
    };

    expect(hasActiveNegotiatedPrice(item)).toBe(false);
    expect(getCartItemEffectivePrice(item)).toBe(0);
  });

  it('ignores stale accepted negotiated prices for best-price items', () => {
    const item = {
      brand: 'Tecno',
      name: 'Tecno Spark 50',
      price: 150000,
      negotiatedPrice: 147000,
      negotiationStatus: 'accepted' as const,
    };

    expect(hasActiveNegotiatedPrice(item)).toBe(false);
    expect(getCartItemEffectivePrice(item)).toBe(150000);
  });
});
