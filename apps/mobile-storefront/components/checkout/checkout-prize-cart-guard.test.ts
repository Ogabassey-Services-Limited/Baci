import { Alert } from 'react-native';
import type { CartItem } from '@/stores/cart-store';
import {
  blockIfMixedPrizeCart,
  cartHasVoucherLine,
} from './checkout-prize-cart-guard';

const paidItem: CartItem = {
  id: 'line-1',
  name: 'iPhone 15 Pro',
  price: 1_200_000,
  product_id: 'product-1',
  quantity: 1,
  slug: 'iphone-15-pro',
};

const voucherItem: CartItem = {
  id: 'line-prize',
  name: 'iPhone 15 (Prize)',
  price: 0,
  product_id: 'product-prize',
  quantity: 1,
  slug: 'iphone-15',
  voucher_token: 'qv1.aaa.bbb',
  voucher_award_id: 'award-1',
};

describe('blockIfMixedPrizeCart', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks and alerts a cart that mixes a voucher line with paid items', () => {
    expect(blockIfMixedPrizeCart([paidItem, voucherItem])).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Check out your prize separately',
      expect.stringContaining('redeemed on its own order'),
      [{ text: 'OK' }]
    );
  });

  it('allows a voucher-only cart', () => {
    expect(blockIfMixedPrizeCart([voucherItem])).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('allows a paid-only cart', () => {
    expect(blockIfMixedPrizeCart([paidItem])).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('allows an empty cart', () => {
    expect(blockIfMixedPrizeCart([])).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('cartHasVoucherLine', () => {
  it('detects a voucher line', () => {
    expect(cartHasVoucherLine([voucherItem])).toBe(true);
    expect(cartHasVoucherLine([paidItem, voucherItem])).toBe(true);
  });

  it('returns false for paid-only and empty carts', () => {
    expect(cartHasVoucherLine([paidItem])).toBe(false);
    expect(cartHasVoucherLine([])).toBe(false);
  });
});
