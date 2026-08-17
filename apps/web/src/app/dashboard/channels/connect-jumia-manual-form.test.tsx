import { describe, expect, it } from 'vitest';
import { getJumiaShopSelectionId } from './connect-jumia-manual-form';

describe('getJumiaShopSelectionId', () => {
  it('prefers the selection key when present', () => {
    expect(
      getJumiaShopSelectionId({
        id: 'shop-1',
        selectionKey: 'shop-1:NG',
        name: 'Shop',
        countryCode: 'NG',
        marketplace: 'Jumia',
        alreadyConnected: false,
      })
    ).toBe('shop-1:NG');
  });
});
