import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initializeErrorMonitoring(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  const dsn = env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn || initialized) {
    return false;
  }

  Sentry.init({
    attachScreenshot: false,
    attachThreads: true,
    debug: typeof __DEV__ !== 'undefined' && __DEV__,
    dsn,
    enableAnrFingerprinting: true,
    enableAutoPerformanceTracing: false,
    enableAutoSessionTracking: true,
    enableHistoricalTombstoneReporting: true,
    enableNative: true,
    enableNativeCrashHandling: true,
    enableTombstone: true,
    environment: env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() || 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  initialized = true;
  return true;
}
