import type { TikTokBusinessPlugin } from '@baci/tiktok-business';
import type { ExpoConfig } from 'expo/config';
import { createExpoPlugins } from './expo-plugins';

describe('createExpoPlugins', () => {
  it('enables R8 minification and resource shrinking for Android release builds', () => {
    const plugins = createExpoPlugins({
      facebookSdkPlugin: null,
      tiktokBusinessPlugin: null,
    });
    const buildPropertiesPlugin = plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
    );

    expect(buildPropertiesPlugin?.[1]).toMatchObject({
      android: {
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
      },
    });
  });

  it('includes supplied conditional plugins and omits them when unconfigured', () => {
    const facebookSdkPlugin: NonNullable<ExpoConfig['plugins']>[number] = [
      'react-native-fbsdk-next',
      { appID: '123456789' },
    ];
    const tiktokBusinessPlugin: TikTokBusinessPlugin = [
      '@baci/tiktok-business/plugin',
      {
        ios: {
          appId: '6472735367',
          appSecret: 'secret',
          autoInitialize: false,
          tiktokAppId: '7644050881196883975',
        },
      },
    ];

    expect(
      createExpoPlugins({
        facebookSdkPlugin,
        tiktokBusinessPlugin,
      })
    ).toEqual(
      expect.arrayContaining([facebookSdkPlugin, tiktokBusinessPlugin])
    );

    const unconfiguredPlugins = createExpoPlugins({
      facebookSdkPlugin: null,
      tiktokBusinessPlugin: null,
    });
    expect(
      unconfiguredPlugins.some(
        (plugin) =>
          Array.isArray(plugin) && plugin[0] === 'react-native-fbsdk-next'
      )
    ).toBe(false);
    expect(
      unconfiguredPlugins.some(
        (plugin) =>
          Array.isArray(plugin) && plugin[0] === '@baci/tiktok-business/plugin'
      )
    ).toBe(false);
  });
});
