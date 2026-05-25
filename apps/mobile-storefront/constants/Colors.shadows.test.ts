import { afterEach, describe, expect, it, jest } from '@jest/globals';

function loadShadowsForPlatform(platform: 'web' | 'ios') {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Dimensions: {
      get: jest.fn(() => ({ width: 375 })),
    },
    Platform: {
      select: jest.fn((styles: Record<string, unknown>) =>
        platform === 'web' ? styles.web : styles.default
      ),
    },
  }));

  return (require('./Colors') as typeof import('./Colors')).SHADOWS;
}

describe('SHADOWS platform tokens', () => {
  afterEach(() => {
    jest.dontMock('react-native');
    jest.resetModules();
  });

  it('uses CSS box-shadow on web instead of native shadow props', () => {
    const shadows = loadShadowsForPlatform('web');

    expect(shadows).toEqual({
      none: {},
      sm: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
      },
      md: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
      },
      medium: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
      },
      lg: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
      },
      xl: {
        boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.12)',
      },
    });
  });

  it('retains native shadow and elevation values for iOS', () => {
    const shadows = loadShadowsForPlatform('ios');

    expect(shadows).toEqual({
      none: {},
      sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
      md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
      medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
      lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      },
      xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
      },
    });
  });
});
