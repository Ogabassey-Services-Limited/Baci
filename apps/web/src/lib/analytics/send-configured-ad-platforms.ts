import { sanitizeEventErrorMessage } from '@/lib/events/sanitize-event-error';
import { logger } from '@/lib/logger';
import type {
  AdPlatformDeliveryOptions,
  ConversionEvent,
} from './ad-platform-conversion-event';
import { getAdPlatformEventMappings } from './ad-platform-event-mappings';
import type { AdPlatformResults } from './ad-platform-results';
import type { AnalyticsPlatformConfig } from './analytics-platform-config-types';
import { sendFacebookAdPlatformEvent } from './send-facebook-ad-platform-event';
import { sendSnapchatAdPlatformEvent } from './send-snapchat-ad-platform-event';
import { sendTikTokAdPlatformEvent } from './send-tiktok-ad-platform-event';

type ProviderResult = {
  success: boolean;
  error?: string;
  httpStatus?: number;
};

function configuredStringValues(
  config: Readonly<AnalyticsPlatformConfig>
): string[] {
  return [...new Set(Object.values(config))]
    .filter((value): value is string =>
      Boolean(typeof value === 'string' && value.length)
    )
    .sort((left, right) => right.length - left.length);
}

function sanitizeObservedString(
  value: string,
  config: Readonly<AnalyticsPlatformConfig>
): string {
  return sanitizeEventErrorMessage(value, configuredStringValues(config)) ?? '';
}

function projectProviderResult(
  result: ProviderResult,
  config: Readonly<AnalyticsPlatformConfig>
): ProviderResult {
  const projectedResult: ProviderResult = {
    success: result.success,
    ...(Number.isInteger(result.httpStatus) &&
    Number.isFinite(result.httpStatus) &&
    (result.httpStatus ?? 0) >= 100 &&
    (result.httpStatus ?? 0) <= 599
      ? { httpStatus: result.httpStatus }
      : {}),
  };
  if (!result.error) return projectedResult;
  return {
    ...projectedResult,
    error: sanitizeObservedString(result.error, config),
  };
}

export async function sendConfiguredAdPlatforms(
  config: Readonly<AnalyticsPlatformConfig>,
  event: ConversionEvent,
  options: AdPlatformDeliveryOptions = {}
): Promise<AdPlatformResults> {
  if (config.offline_conversions_enabled === false) return {};
  const mappings = getAdPlatformEventMappings(event.event_type);
  const enabled = (target: 'facebook' | 'snapchat' | 'tiktok') =>
    !event.targets || event.targets.includes(target);
  const jobs: Array<{
    name: keyof AdPlatformResults;
    run: Promise<ProviderResult>;
  }> = [];
  if (mappings.facebook && enabled('facebook')) {
    jobs.push({
      name: 'facebook',
      run: sendFacebookAdPlatformEvent(
        config,
        event,
        mappings.facebook,
        options.signal
      ),
    });
  }
  if (mappings.tiktok && enabled('tiktok')) {
    jobs.push({
      name: 'tiktok',
      run: sendTikTokAdPlatformEvent(
        config,
        event,
        mappings.tiktok,
        options.signal
      ),
    });
  }
  if (mappings.snapchat && enabled('snapchat')) {
    jobs.push({
      name: 'snapchat',
      run: sendSnapchatAdPlatformEvent(
        config,
        event,
        mappings.snapchat,
        options.signal
      ),
    });
  }
  const settled = await Promise.allSettled(jobs.map((job) => job.run));
  const results: AdPlatformResults = {};
  for (const [index, result] of settled.entries()) {
    const platform = jobs[index]?.name;
    if (!platform) continue;
    results[platform] =
      result.status === 'fulfilled'
        ? projectProviderResult(result.value, config)
        : { success: false, error: 'unhandled_error' };
  }
  logger.info({
    message: sanitizeObservedString('CAPI fan-out complete', config),
    eventType: sanitizeObservedString(event.event_type, config),
    eventId: sanitizeObservedString(event.event_id, config),
    source: sanitizeObservedString(event.source, config),
    merchantId: sanitizeObservedString(event.merchant_id, config),
    results: jobs.map((job, index) => {
      const settledResult = settled[index];
      const providerResult =
        settledResult?.status === 'fulfilled'
          ? settledResult.value
          : { error: 'unhandled_error', success: false };
      const summary =
        providerResult.error === 'not_configured'
          ? `${job.name}:skip`
          : providerResult.success
            ? `${job.name}:ok`
            : `${job.name}:fail(${providerResult.error})`;
      return sanitizeObservedString(summary, config);
    }),
  });
  return results;
}
