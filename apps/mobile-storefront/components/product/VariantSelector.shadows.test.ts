import { getVariantColorSwatchShadowStyle } from './VariantSelector.shadows';

describe('getVariantColorSwatchShadowStyle', () => {
  it('uses CSS box-shadow on web', () => {
    expect(getVariantColorSwatchShadowStyle('web')).toEqual({
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
    });
  });

  it('preserves the native color-swatch shadow contract', () => {
    expect(getVariantColorSwatchShadowStyle('native')).toEqual({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    });
  });
});
