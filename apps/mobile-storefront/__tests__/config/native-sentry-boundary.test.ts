import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('native Sentry initialization boundary', () => {
  it('keeps early native initialization production-prebuild-only', () => {
    const mainApplication = readFileSync(
      path.resolve(
        __dirname,
        '../../android/app/src/main/java/com/ogabassey/store/MainApplication.kt'
      ),
      'utf8'
    );

    expect(mainApplication).not.toContain('RNSentrySDK.init');
  });

  it('keeps unsafe Worklets bundle mode out of Android production releases', () => {
    const workflowSource = readFileSync(
      path.resolve(
        __dirname,
        '../../../../.github/workflows/android-storefront-release.yml'
      ),
      'utf8'
    );

    expect(workflowSource).not.toContain(
      'BACI_MOBILE_STOREFRONT_WORKLETS_BUNDLE_MODE'
    );
  });

  it('requires Sentry release credentials for native ANR symbolication', () => {
    const appConfigSource = readFileSync(
      path.resolve(__dirname, '../../app.config.ts'),
      'utf8'
    );
    expect(appConfigSource).toContain("process.env.CI === '1'");

    for (const workflowPath of [
      '../../../../.github/workflows/android-storefront-release.yml',
      '../../../../.github/workflows/ios-storefront-release.yml',
    ]) {
      const workflowSource = readFileSync(
        path.resolve(__dirname, workflowPath),
        'utf8'
      );

      for (const variable of [
        'EXPO_PUBLIC_SENTRY_DSN',
        'SENTRY_AUTH_TOKEN',
        'SENTRY_ORG',
        'SENTRY_PROJECT',
        'SENTRY_URL',
      ]) {
        expect(workflowSource).toContain(variable);
      }
    }
  });

  it('composes the generated iOS Sentry and fixed PostHog wrappers', () => {
    const project = readFileSync(
      path.resolve(__dirname, '../../ios/Ogabassey.xcodeproj/project.pbxproj'),
      'utf8'
    );

    const sentryWrapperIndex = project.indexOf('sentry-xcode.sh');
    const postHogWrapperIndex = project.indexOf('posthog-xcode.sh');

    expect(sentryWrapperIndex).toBeGreaterThan(-1);
    expect(postHogWrapperIndex).toBeGreaterThan(sentryWrapperIndex);
    expect(
      project.slice(sentryWrapperIndex, postHogWrapperIndex)
    ).not.toContain('/bin/sh');
  });
});
