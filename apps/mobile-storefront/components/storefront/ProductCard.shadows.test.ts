import { getProductCardShadowStyles } from './ProductCard.shadows';

describe('getProductCardShadowStyles', () => {
  it('returns CSS box shadows on web', () => {
    expect(
      getProductCardShadowStyles('web', '#000000', '#111827')
    ).toEqual({
      gridContainer: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
      },
      floatingCartBtn: {
        boxShadow: '0px 2px 4px rgba(17, 24, 39, 0.1)',
      },
    });
  });

  it('preserves the native shadow contract', () => {
    expect(
      getProductCardShadowStyles('native', '#000000', '#111827')
    ).toEqual({
      gridContainer: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
      floatingCartBtn: {
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    });
  });
});
