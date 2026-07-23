import type {
  AdPlatformDeliveryOptions,
  ConversionEvent,
} from './ad-platform-conversion-event';
import type { AdPlatformResults } from './ad-platform-results';
import type { AnalyticsPlatformConfig } from './analytics-platform-config-types';
import { sendConfiguredAdPlatforms } from './send-configured-ad-platforms';

export type {
  AdPlatformDeliveryOptions,
  ConversionEvent,
} from './ad-platform-conversion-event';
export type { AdPlatformResults } from './ad-platform-results';
export type { AdPlatformTarget } from './ad-platform-target';
export { isConversionEvent } from './is-conversion-event';
export { normalizeEventType } from './normalize-ad-platform-event-type';

export async function sendToAdPlatforms(
  config: Readonly<AnalyticsPlatformConfig>,
  event: ConversionEvent,
  options?: AdPlatformDeliveryOptions
): Promise<AdPlatformResults> {
  return await sendConfiguredAdPlatforms(config, event, options);
}
