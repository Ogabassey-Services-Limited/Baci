import 'server-only';
import type { ServiceRoleClient } from '@/lib/supabase/service';
import type {
  AdPlatformDeliveryOptions,
  ConversionEvent,
} from './ad-platform-conversion-event';
import type { AdPlatformResults } from './ad-platform-results';
import { fetchAnalyticsPlatformConfig } from './fetch-analytics-platform-config';
import { sendConfiguredAdPlatforms } from './send-configured-ad-platforms';

export async function trustedServerAdPlatformFanout(
  client: ServiceRoleClient,
  resolvedMerchantId: string,
  event: ConversionEvent,
  options?: AdPlatformDeliveryOptions
): Promise<AdPlatformResults> {
  if (event.merchant_id !== resolvedMerchantId) return {};
  const config = await fetchAnalyticsPlatformConfig(client, resolvedMerchantId);
  if (!config) return {};
  return await sendConfiguredAdPlatforms(config, event, options);
}
