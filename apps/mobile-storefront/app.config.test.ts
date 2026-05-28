import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ConfigContext, ExpoConfig } from 'expo/config';

jest.mock('dotenv/config', () => ({}));

const originalEnv = process.env;

function loadAppConfigWithFacebookEnv(env: {
  STOREFRONT_FACEBOOK_APP_ID?: string;
  STOREFRONT_FACEBOOK_CLIENT_TOKEN?: string;
}) {
  jest.resetModules();
  process.env = { ...originalEnv };
  delete process.env.STOREFRONT_FACEBOOK_APP_ID;
  delete process.env.STOREFRONT_FACEBOOK_CLIENT_TOKEN;

  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }

  return (require('./app.config') as { default: (context: ConfigContext) => ExpoConfig }).default;
}

function renderConfig(appConfig: (context: ConfigContext) => ExpoConfig) {
  return appConfig({
    config: {} as ExpoConfig,
    packageJsonPath: '',
    projectRoot: '',
    staticConfigPath: '',
  } as ConfigContext);
}

function findFacebookPlugin(config: ExpoConfig) {
  return config.plugins?.find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === 'react-native-fbsdk-next'
  );
}

describe('Facebook SDK Expo config', () => {
  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('fails fast when both Facebook SDK credentials are absent from the environment', () => {
    expect(() => {
      const appConfig = loadAppConfigWithFacebookEnv({});
      renderConfig(appConfig);
    }).toThrow(/STOREFRONT_FACEBOOK_APP_ID and STOREFRONT_FACEBOOK_CLIENT_TOKEN/);
  });

  it('injects the Facebook SDK plugin when both credentials are configured', () => {
    const appConfig = loadAppConfigWithFacebookEnv({
      STOREFRONT_FACEBOOK_APP_ID: '123456789',
      STOREFRONT_FACEBOOK_CLIENT_TOKEN: 'client-token',
    });
    const config = renderConfig(appConfig);

    expect(findFacebookPlugin(config)).toEqual([
      'react-native-fbsdk-next',
      {
        advertiserIDCollectionEnabled: false,
        appID: '123456789',
        autoLogAppEventsEnabled: false,
        clientToken: 'client-token',
        displayName: 'Ogabassey',
        scheme: 'fb123456789',
      },
    ]);
    expect(config.extra?.facebookAppId).toBe('123456789');
    expect(config.extra?.facebookClientToken).toBe('client-token');
  });

  it('fails fast when Facebook SDK credentials are only partially configured', () => {
    expect(() =>
      loadAppConfigWithFacebookEnv({
        STOREFRONT_FACEBOOK_APP_ID: '123456789',
      })
    ).toThrow(/STOREFRONT_FACEBOOK_APP_ID and STOREFRONT_FACEBOOK_CLIENT_TOKEN/);

    expect(() =>
      loadAppConfigWithFacebookEnv({
        STOREFRONT_FACEBOOK_CLIENT_TOKEN: 'client-token',
      })
    ).toThrow(/STOREFRONT_FACEBOOK_APP_ID and STOREFRONT_FACEBOOK_CLIENT_TOKEN/);
  });
});
