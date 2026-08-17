import * as Sentry from '@sentry/react-native';
import {
  acknowledgePreviousProcessExit,
  getPreviousProcessExit,
  type PreviousProcessExit,
} from '@/lib/anr-telemetry';
import { trackEvent } from './analytics';

let initialized = false;

const bundledDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const bundledEnvironment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;

function buildPreviousExitProperties(
  previousExit: PreviousProcessExit
): Record<string, string | number | boolean | null> {
  return {
    importance: previousExit.importance ?? null,
    pid: previousExit.pid ?? null,
    process_state_summary: previousExit.processStateSummary ?? null,
    reason: previousExit.reason ?? 'UNKNOWN',
    reason_code: previousExit.reasonCode ?? null,
    timestamp: previousExit.timestamp,
    trace_available: previousExit.traceAvailable === true,
  };
}

function resolvePreviousExitSurface(summary: unknown): string {
  const match =
    typeof summary === 'string'
      ? summary.match(
          /(?:^|\|)surface=(home|gadget_pattern|none|startup)(?:\||$)/
        )
      : null;
  return match?.[1] ?? 'unknown';
}

export async function reportPreviousProcessExit(): Promise<void> {
  const previousExit = await getPreviousProcessExit();
  if (!previousExit) return;

  const properties = buildPreviousExitProperties(previousExit);
  try {
    Sentry.setContext('previous_process_exit', properties);
    Sentry.setTag('previous_exit_reason', String(properties.reason));
    Sentry.setTag(
      'previous_exit_surface',
      resolvePreviousExitSurface(properties.process_state_summary)
    );
    Sentry.addBreadcrumb({
      category: 'performance.process_exit',
      data: properties,
      level: 'warning',
      message: `previous_process_exit:${String(properties.reason)}`,
    });
    if (properties.reason === 'ANR') {
      Sentry.captureMessage('previous_process_exit:ANR', 'warning');
      trackEvent('previous_process_exit', properties);
    }
  } catch {
    // A telemetry backend failure must not block the next app launch.
  } finally {
    acknowledgePreviousProcessExit(previousExit.timestamp);
  }
}

export function initializeErrorMonitoring(
  env?: Readonly<Record<string, string | undefined>>
): boolean {
  const dsn = (env?.EXPO_PUBLIC_SENTRY_DSN ?? bundledDsn)?.trim();
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
    environment:
      (env?.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? bundledEnvironment)?.trim() ||
      'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  initialized = true;
  void reportPreviousProcessExit();
  return true;
}
