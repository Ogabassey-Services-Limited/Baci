import { palette, withAlpha } from '@/constants/Colors';
import { getSnowflakeShadowStyle } from './SnowEffect.shadows';

describe('getSnowflakeShadowStyle', () => {
  it('uses CSS box-shadow on web', () => {
    expect(getSnowflakeShadowStyle('web')).toEqual({
      boxShadow: `0px 0px 2px ${withAlpha(palette.white, 0.5)}`,
    });
  });

  it('preserves native snowflake shadows', () => {
    expect(getSnowflakeShadowStyle('native')).toEqual({
      shadowColor: palette.white,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 2,
    });
  });
});
