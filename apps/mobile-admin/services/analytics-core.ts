import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import {
  type AdminAnalyticsProperties,
  sanitizeAdminAnalyticsCaptureEvent,
  sanitizeAdminAnalyticsProperties,
} from './analytics-privacy';

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';
const POSTHOG_API_KEY =
  Constants.expoConfig?.extra?.posthogApiKey?.trim?.() || '';
const POSTHOG_HOST =
  Constants.expoConfig?.extra?.posthogHost?.trim?.() || DEFAULT_POSTHOG_HOST;
const APP_VERSION = Constants.expoConfig?.version;

type AdminUserProperties = {
  merchantId?: string | null;
  planTier?: string | null;
  isPublished?: boolean | null;
};

let posthogClient: PostHog | null = null;

function getAdminAnalyticsSuperProperties(): AdminAnalyticsProperties {
  return (
    sanitizeAdminAnalyticsProperties({
      app_surface: 'mobile-admin',
      release_version: APP_VERSION,
    }) ?? {}
  );
}

function registerAdminAnalyticsSuperProperties(): void {
  if (!posthogClient) return;
  void posthogClient.register(getAdminAnalyticsSuperProperties());
}

function getSafeUserProperties(
  properties: AdminUserProperties | undefined
): AdminAnalyticsProperties {
  return (
    sanitizeAdminAnalyticsProperties({
      merchant_id: properties?.merchantId,
      plan_tier: properties?.planTier,
      merchant_is_published: properties?.isPublished,
    }) ?? {}
  );
}

export function initAdminAnalytics(): boolean {
  if (posthogClient) {
    return true;
  }

  if (!POSTHOG_API_KEY) {
    if (__DEV__) {
      console.warn(
        '[PostHog] EXPO_PUBLIC_POSTHOG_API_KEY is missing; mobile-admin error tracking is disabled.'
      );
    }
    return false;
  }

  try {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      before_send: sanitizeAdminAnalyticsCaptureEvent,
      captureAppLifecycleEvents: true,
      customAppProperties: (properties) => ({
        ...properties,
        ...getAdminAnalyticsSuperProperties(),
      }),
      enableSessionReplay: false,
      flushAt: 20,
      flushInterval: 30_000,
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          nativeCrashes: true,
          // Keep console capture off. React logs caught render errors to console,
          // and ErrorBoundary manually reports them once with component context.
          console: false,
        },
      },
    });

    registerAdminAnalyticsSuperProperties();
    return true;
  } catch (error) {
    posthogClient = null;
    console.warn(
      '[PostHog] Failed to initialize mobile-admin analytics:',
      error
    );
    return false;
  }
}

export function getAdminPostHog(): PostHog | null {
  return posthogClient;
}

export function identifyAdminUser(
  userId: string,
  properties?: AdminUserProperties
): void {
  if (!posthogClient && !initAdminAnalytics()) return;
  if (!posthogClient) return;

  posthogClient.identify(userId, {
    ...getSafeUserProperties(properties),
    $set_once: {
      first_seen: new Date().toISOString(),
    },
  });
}

export function resetAdminAnalytics(): void {
  if (!posthogClient) return;
  posthogClient.reset();
  registerAdminAnalyticsSuperProperties();
}

export function captureAdminException(
  error: unknown,
  properties?: Record<string, unknown>
): boolean {
  if (!posthogClient && !initAdminAnalytics()) {
    return false;
  }

  if (!posthogClient) {
    return false;
  }

  posthogClient.captureException(
    error,
    sanitizeAdminAnalyticsProperties({
      ...properties,
      app_surface: 'mobile-admin',
    })
  );
  return true;
}

export async function shutdownAdminAnalytics(): Promise<void> {
  if (!posthogClient) return;

  const client = posthogClient;
  posthogClient = null;
  await client.flush();
  await client.shutdown();
}
