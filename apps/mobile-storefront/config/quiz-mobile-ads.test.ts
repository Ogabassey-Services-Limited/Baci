import { getQuizMobileAdsConfig } from './quiz-mobile-ads';

describe('getQuizMobileAdsConfig', () => {
  it('disables ads when the build-time kill switch is off', () => {
    expect(
      getQuizMobileAdsConfig({
        development: true,
        environment: { EXPO_PUBLIC_QUIZ_ADS_ENABLED: 'false' },
        platform: 'android',
      })
    ).toEqual({ enabled: false });
  });

  it('uses Google adaptive-banner test IDs in development', () => {
    expect(
      getQuizMobileAdsConfig({
        development: true,
        environment: { EXPO_PUBLIC_QUIZ_ADS_ENABLED: 'true' },
        platform: 'android',
      })
    ).toEqual({
      bannerUnitId: 'ca-app-pub-3940256099942544/9214589741',
      enabled: true,
    });
    expect(
      getQuizMobileAdsConfig({
        development: true,
        environment: { EXPO_PUBLIC_QUIZ_ADS_ENABLED: 'true' },
        platform: 'ios',
      })
    ).toEqual({
      bannerUnitId: 'ca-app-pub-3940256099942544/2435281174',
      enabled: true,
    });
  });

  it('disables the native placement on web', () => {
    expect(
      getQuizMobileAdsConfig({
        development: true,
        environment: { EXPO_PUBLIC_QUIZ_ADS_ENABLED: 'true' },
        platform: 'web',
      })
    ).toEqual({ enabled: false });
  });

  it('selects and validates the production unit ID for each platform', () => {
    const environment = {
      EXPO_PUBLIC_QUIZ_ADMOB_ANDROID_BANNER_UNIT_ID:
        'ca-app-pub-1234567890123456/3333333333',
      EXPO_PUBLIC_QUIZ_ADMOB_IOS_BANNER_UNIT_ID:
        'ca-app-pub-1234567890123456/4444444444',
      EXPO_PUBLIC_QUIZ_ADS_ENABLED: 'true',
    };

    expect(
      getQuizMobileAdsConfig({
        development: false,
        environment,
        platform: 'android',
      })
    ).toEqual({
      bannerUnitId: 'ca-app-pub-1234567890123456/3333333333',
      enabled: true,
    });
    expect(
      getQuizMobileAdsConfig({
        development: false,
        environment,
        platform: 'ios',
      })
    ).toEqual({
      bannerUnitId: 'ca-app-pub-1234567890123456/4444444444',
      enabled: true,
    });
  });

  it.each<{ label: string; unitId: string | undefined }>([
    { label: 'missing', unitId: undefined },
    { label: 'malformed', unitId: 'demo-unit-id' },
    {
      label: 'Google sample',
      unitId: 'ca-app-pub-3940256099942544/9214589741',
    },
  ])('rejects a $label production banner unit ID', ({ unitId }) => {
    expect(() =>
      getQuizMobileAdsConfig({
        development: false,
        environment: {
          EXPO_PUBLIC_QUIZ_ADMOB_ANDROID_BANNER_UNIT_ID: unitId,
          EXPO_PUBLIC_QUIZ_ADS_ENABLED: 'true',
        },
        platform: 'android',
      })
    ).toThrow('EXPO_PUBLIC_QUIZ_ADMOB_ANDROID_BANNER_UNIT_ID');
  });
});
