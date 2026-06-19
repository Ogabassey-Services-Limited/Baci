import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import { createLogger } from '@/lib/logger';

const log = createLogger('Analytics');

const POSTHOG_API_KEY = Constants.expoConfig?.extra?.posthogApiKey || '';
const POSTHOG_HOST =
  Constants.expoConfig?.extra?.posthogHost || 'https://eu.i.posthog.com';

let posthogClient: PostHog | null = null;

export function initAnalytics(): void {
  if (!POSTHOG_API_KEY) {
    log.warn('PostHog API key not configured');
    return;
  }

  try {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: true,
      enableSessionReplay: true,
      sessionReplayConfig: {
        maskAllTextInputs: true,
        maskAllImages: false,
        captureNetworkTelemetry: true,
      },
      flushAt: 20,
      flushInterval: 30000,
      // Crash/error tracking. Unhandled JS errors and promise rejections are
      // attributed automatically to the user set via identifyUser(), so each
      // crash is tied to the merchant who hit it. Capture also requires the
      // "Enable exception autocapture" toggle in the PostHog project settings.
      // Native iOS/Android crash capture (nativeCrashes) needs
      // posthog-react-native >= 4.47.0 + @posthog/react-native-plugin and is
      // intentionally not enabled here.
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          // Console capture stays off: it would turn third-party/React
          // console.error output into noise (this app's logger is dev-only,
          // so handled errors are not logged in production). To also capture
          // logged errors as exceptions, set `console: ['error']`.
          console: false,
        },
      },
    });

    log.info('PostHog initialized');
  } catch (error) {
    log.error('Failed to initialize PostHog:', error);
  }
}

export function getPostHog(): PostHog | null {
  return posthogClient;
}

export function identifyUser(
  userId: string,
  properties?: {
    email?: string;
    name?: string;
    phone?: string;
    merchantId?: string;
    loyaltyTier?: string;
    loyaltyPoints?: number;
    createdAt?: string;
  }
): void {
  if (!posthogClient) return;

  posthogClient.identify(userId, {
    ...properties,
    $set_once: {
      first_seen: new Date().toISOString(),
    },
  });
}

export function resetUser(): void {
  if (!posthogClient) return;
  posthogClient.reset();
}

export function setUserProperties(
  properties: Record<string, string | number | boolean | null>
): void {
  if (!posthogClient) return;
  posthogClient.capture('$set', { $set: properties });
}

export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (!posthogClient) return;

  posthogClient.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Manually report a handled error to PostHog error tracking. Unhandled errors
 * are captured automatically; use this in catch blocks for errors you recover
 * from but still want visibility into. Attributed to the user set via
 * {@link identifyUser}; pass `properties` to stamp per-event context.
 */
export function captureException(
  error: unknown,
  properties?: Record<string, string | number | boolean | null>
): void {
  if (!posthogClient) return;

  posthogClient.captureException(error, properties);
}

export function trackScreen(
  screenName: string,
  properties?: Record<string, unknown>
): void {
  if (!posthogClient) return;

  posthogClient.screen(screenName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  if (!posthogClient) return false;

  try {
    const value = await posthogClient.isFeatureEnabled(flagKey);
    return value === true;
  } catch {
    return false;
  }
}

export async function getFeatureFlagValue(
  flagKey: string
): Promise<string | boolean | undefined> {
  if (!posthogClient) return undefined;

  try {
    return await posthogClient.getFeatureFlag(flagKey);
  } catch {
    return undefined;
  }
}

export async function reloadFeatureFlags(): Promise<void> {
  if (!posthogClient) return;

  try {
    await posthogClient.reloadFeatureFlags();
  } catch (error) {
    log.error('Failed to reload feature flags:', error);
  }
}

export async function shutdownAnalytics(): Promise<void> {
  if (!posthogClient) return;

  try {
    await posthogClient.flush();
    await posthogClient.shutdown();
    posthogClient = null;
  } catch (error) {
    log.error('Error during shutdown:', error);
  }
}
