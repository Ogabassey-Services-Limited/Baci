import { getTypingIndicatorDotShadowStyle } from './TypingIndicator.shadows';

describe('getTypingIndicatorDotShadowStyle', () => {
  it('uses CSS box-shadow on web', () => {
    expect(getTypingIndicatorDotShadowStyle('web')).toEqual({
      boxShadow: '0px 1px 4px rgba(220, 38, 38, 0.12)',
    });
  });

  it('preserves the native typing-dot shadow contract', () => {
    expect(getTypingIndicatorDotShadowStyle('native')).toEqual({
      elevation: 3,
      shadowColor: '#DC2626',
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    });
  });
});
