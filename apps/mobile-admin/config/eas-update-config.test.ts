import {
  buildEasUpdateConfig,
  createExpoDevClientPlugin,
  EAS_PROJECT_ID,
  EAS_UPDATE_URL,
} from './eas-update-config';

describe('buildEasUpdateConfig', () => {
  it('binds app-version runtime policy to the EAS project update URL', () => {
    const config = buildEasUpdateConfig({});

    expect(config.easProjectId).toBe(EAS_PROJECT_ID);
    expect(config.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(config.updates).toMatchObject({
      checkAutomatically: 'ON_LOAD',
      enableBsdiffPatchSupport: true,
      enabled: true,
      fallbackToCacheTimeout: 0,
      url: EAS_UPDATE_URL,
      useEmbeddedUpdate: true,
      requestHeaders: {
        'expo-channel-name': 'production',
      },
    });
  });

  it('embeds an explicit preview channel override', () => {
    const config = buildEasUpdateConfig({
      EXPO_UPDATE_CHANNEL: 'preview',
    });

    expect(config.updates.requestHeaders).toEqual({
      'expo-channel-name': 'preview',
    });
  });

  it('disables OTA checks for development clients', () => {
    const config = buildEasUpdateConfig({
      EAS_BUILD_PROFILE: 'development',
    });

    expect(config.updates).toEqual({ enabled: false });
  });
});

describe('createExpoDevClientPlugin', () => {
  it('launches the most recently opened project without a hardcoded URL', () => {
    expect(createExpoDevClientPlugin()).toEqual([
      'expo-dev-client',
      { launchMode: 'most-recent' },
    ]);
  });
});
