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
