import { palette, withAlpha } from '@/constants/Colors';
import { getDrawerMenuShadowStyles } from './DrawerMenu.shadows';

describe('getDrawerMenuShadowStyles', () => {
  it('uses CSS box shadows on web', () => {
    expect(getDrawerMenuShadowStyles('web')).toEqual({
      authButton: {
        boxShadow: `0px 2px 4px ${withAlpha(palette.black, 0.1)}`,
      },
      drawer: {
        boxShadow: `4px 0px 20px ${withAlpha(palette.black, 0.15)}`,
      },
    });
  });

  it('preserves native drawer shadows', () => {
    expect(getDrawerMenuShadowStyles('native')).toEqual({
      authButton: {
        shadowColor: palette.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
      drawer: {
        shadowColor: palette.black,
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 24,
      },
    });
  });
});
