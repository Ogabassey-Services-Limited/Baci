import { palette, withAlpha } from '@/constants/Colors';
import { getConnectivityBannerShadowStyle } from './ConnectivityBanner.shadows';

describe('getConnectivityBannerShadowStyle', () => {
  it('uses CSS box-shadow on web', () => {
    expect(getConnectivityBannerShadowStyle('web')).toEqual({
      boxShadow: `0px 2px 4px ${withAlpha(palette.black, 0.1)}`,
    });
  });

  it('preserves native banner shadow styling', () => {
    expect(getConnectivityBannerShadowStyle('native')).toEqual({
      shadowColor: palette.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    });
  });
});
