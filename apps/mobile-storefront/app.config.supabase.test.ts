import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ConfigContext, ExpoConfig } from 'expo/config';

jest.mock('dotenv/config', () => ({}));

const originalEnv = process.env;

function loadAppConfigWithEnv(env: {
  EXPO_PUBLIC_POSTHOG_API_KEY?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  EXPO_PUBLIC_SUPABASE_URL?: string;
  STOREFRONT_FACEBOOK_APP_ID?: string;
  STOREFRONT_FACEBOOK_CLIENT_TOKEN?: string;
}) {
  jest.resetModules();
  process.env = { ...originalEnv };
  delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.STOREFRONT_FACEBOOK_APP_ID;
  delete process.env.STOREFRONT_FACEBOOK_CLIENT_TOKEN;

  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }

  return jest.requireActual<typeof import('./app.config')>('./app.config')
    .default;
}

function renderConfig(appConfig: (context: ConfigContext) => ExpoConfig) {
  return appConfig({
    config: {} as ExpoConfig,
    packageJsonPath: '',
    projectRoot: '',
    staticConfigPath: '',
  } as ConfigContext);
}

describe('Expo app config Supabase keys', () => {
  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('exposes the configured Supabase publishable key', () => {
    const config = renderConfig(
      loadAppConfigWithEnv({
        EXPO_PUBLIC_POSTHOG_API_KEY: 'ph_test',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon-key',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        STOREFRONT_FACEBOOK_APP_ID: '123456789',
        STOREFRONT_FACEBOOK_CLIENT_TOKEN: 'client-token',
      })
    );

    expect(config.extra).toMatchObject({
      supabaseAnonKey: 'legacy-anon-key',
      supabasePublishableKey: 'sb_publishable_test',
      supabaseUrl: 'https://project.supabase.co',
    });
  });

  it('keeps legacy Supabase anon keys out of publishable config', () => {
    const config = renderConfig(
      loadAppConfigWithEnv({
        EXPO_PUBLIC_POSTHOG_API_KEY: 'ph_test',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon-key',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        STOREFRONT_FACEBOOK_APP_ID: '123456789',
        STOREFRONT_FACEBOOK_CLIENT_TOKEN: 'client-token',
      })
    );

    expect(config.extra).toMatchObject({
      supabaseAnonKey: 'legacy-anon-key',
      supabasePublishableKey: '',
    });
  });
});
