import { buildSentryExpoConfiguration } from './sentry-expo-config';

const completeEnvironment = {
  EXPO_PUBLIC_SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
  SENTRY_AUTH_TOKEN: 'build-token',
  SENTRY_ORG: 'ogabassey',
  SENTRY_PROJECT: 'storefront',
};

describe('buildSentryExpoConfiguration', () => {
  it('enables native startup and ANR capture when fully configured', () => {
    const result = buildSentryExpoConfiguration(completeEnvironment, {
      required: true,
    });

    expect(result.plugin).toEqual([
      '@sentry/react-native/expo',
      expect.objectContaining({
        organization: 'ogabassey',
        project: 'storefront',
        useNativeInit: true,
        options: expect.objectContaining({
          enableAnrFingerprinting: true,
          enableNativeCrashHandling: true,
          sendDefaultPii: false,
        }),
      }),
    ]);
  });

  it('fails production configuration when symbol uploads are not configured', () => {
    expect(() =>
      buildSentryExpoConfiguration(
        { EXPO_PUBLIC_SENTRY_DSN: completeEnvironment.EXPO_PUBLIC_SENTRY_DSN },
        { required: true }
      )
    ).toThrow(/SENTRY_AUTH_TOKEN/);
  });

  it('disables the plugin for an incomplete local environment', () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    expect(
      buildSentryExpoConfiguration({}, { required: false }).plugin
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/disabled/));

    warn.mockRestore();
  });
});
