import type { ConfigContext } from 'expo/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('tsx/cjs', () => ({}));

const TEST_CONFIG_CONTEXT = {
  config: {},
  packageJsonPath: '/tmp/package.json',
  projectRoot: '/tmp/mobile-admin',
  staticConfigPath: '/tmp/app.config.ts',
} satisfies ConfigContext;

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('mobile-admin app config PostHog wiring', () => {
  it('exposes PostHog env values and enables the Expo source-map plugin', async () => {
    vi.stubEnv('EXPO_PUBLIC_POSTHOG_API_KEY', 'ph_admin');
    vi.stubEnv('EXPO_PUBLIC_POSTHOG_HOST', 'https://eu.i.posthog.com');

    const { default: buildConfig } = await import('./app.config');
    const config = buildConfig(TEST_CONFIG_CONTEXT);

    expect(config.extra).toMatchObject({
      posthogApiKey: 'ph_admin',
      posthogHost: 'https://eu.i.posthog.com',
    });
    expect(config.plugins).toEqual(
      expect.arrayContaining([
        [
          'posthog-react-native/expo',
          {
            skipOnConflict: true,
            uploadNativeSymbols: true,
          },
        ],
      ])
    );
  });

  it('defaults to the EU ingest host when no host override is provided', async () => {
    vi.stubEnv('EXPO_PUBLIC_POSTHOG_API_KEY', 'ph_admin');
    vi.stubEnv('EXPO_PUBLIC_POSTHOG_HOST', '');

    const { default: buildConfig } = await import('./app.config');
    const config = buildConfig(TEST_CONFIG_CONTEXT);

    expect(config.extra).toMatchObject({
      posthogApiKey: 'ph_admin',
      posthogHost: 'https://eu.i.posthog.com',
    });
  });
});
