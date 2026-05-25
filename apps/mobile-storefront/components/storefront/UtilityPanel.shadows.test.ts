import { getUtilityPanelActiveShadowStyle } from './UtilityPanel.shadows';

describe('getUtilityPanelActiveShadowStyle', () => {
  it('uses boxShadow on web without native shadow properties', () => {
    expect(getUtilityPanelActiveShadowStyle('web', '#000000')).toEqual({
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    });
  });

  it('preserves the active native utility shadow contract', () => {
    expect(getUtilityPanelActiveShadowStyle('native', '#000000')).toEqual({
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    });
  });
});
