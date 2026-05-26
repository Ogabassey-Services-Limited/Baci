import { getEliteHeroCardShadowStyle } from './Hero.shadows';

describe('getEliteHeroCardShadowStyle', () => {
  it('uses boxShadow on web without native shadow properties', () => {
    expect(getEliteHeroCardShadowStyle('web')).toEqual({
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.05)',
    });
  });

  it('preserves the elite card native shadow contract', () => {
    expect(getEliteHeroCardShadowStyle('native')).toEqual({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    });
  });
});
