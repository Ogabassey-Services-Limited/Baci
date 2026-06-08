import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getZohoCampaignsRuntimeConfig,
  type ZohoCampaignsRuntimeConfig,
} from '@/env';
import { createServiceClient } from '@/lib/supabase/service';
import {
  refreshZohoCampaignsAccessToken,
  requireZohoTokenRefreshFields,
  subscribeZohoContactToList,
} from '@/lib/zoho-campaigns-api';
import type { FetchImplementation } from '@/lib/zoho-campaigns-types';
import { resolveMerchantZohoCampaignConfig } from './merchant-zoho-campaign-settings';

export type ZohoNewsletterSyncResult =
  | { status: 'synced' }
  | { reason: string; status: 'skipped' }
  | { error: string; status: 'failed' };

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function syncZohoNewsletterSubscriber({
  config = getZohoCampaignsRuntimeConfig(),
  email,
  fetchImpl = fetch,
  merchantId,
  source,
  supabase = createServiceClient(),
}: {
  config?: ZohoCampaignsRuntimeConfig;
  email: string;
  fetchImpl?: FetchImplementation;
  merchantId?: string | null;
  source: string;
  supabase?: SupabaseClient;
}): Promise<ZohoNewsletterSyncResult> {
  if (!config.enabled) {
    return { reason: 'Zoho Campaigns disabled', status: 'skipped' };
  }
  if (!merchantId) {
    return { reason: 'Missing merchant id', status: 'skipped' };
  }

  try {
    const merchantConfig = await resolveMerchantZohoCampaignConfig({
      config,
      merchantId,
      supabase,
    });

    if (merchantConfig.status === 'skipped') {
      return { reason: merchantConfig.reason, status: 'skipped' };
    }

    const missing = requireZohoTokenRefreshFields(merchantConfig.config);
    const listKey = merchantConfig.config.listKey;
    if (!listKey) {
      return {
        reason: 'Missing Zoho Campaigns config: ZOHO_CAMPAIGNS_LIST_KEY',
        status: 'skipped',
      };
    }
    if (missing.length > 0) {
      return {
        reason: `Missing Zoho Campaigns config: ${missing.join(', ')}`,
        status: 'skipped',
      };
    }

    const accessToken = await refreshZohoCampaignsAccessToken(
      merchantConfig.config,
      fetchImpl
    );
    await subscribeZohoContactToList({
      accessToken,
      apiRootUrl: merchantConfig.config.apiRootUrl,
      contactInfo: {
        ContactEmail: normalizeEmail(email),
        Source: source,
      },
      fetchImpl,
      listKey,
    });

    return { status: 'synced' };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown Zoho sync error';
    console.error('Zoho newsletter subscriber sync failed', {
      error: message,
      merchantId,
    });
    return { error: message, status: 'failed' };
  }
}
