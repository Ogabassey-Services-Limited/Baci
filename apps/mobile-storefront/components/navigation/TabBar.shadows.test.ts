import { getTabBarShadowStyle } from './TabBar.shadows';

describe('getTabBarShadowStyle', () => {
  it('disables tab bar shadow with CSS box-shadow on web', () => {
    expect(getTabBarShadowStyle('web')).toEqual({
      boxShadow: 'none',
    });
  });

  it('preserves the native no-shadow override', () => {
    expect(getTabBarShadowStyle('native')).toEqual({
      elevation: 0,
      shadowOpacity: 0,
    });
  });
});
