import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  dispatchZohoBlogCampaign,
  type ZohoBlogCampaignDispatchInput,
} from './zoho-blog-campaign-dispatch';
import { getZohoBlogCampaignRuntimeConfig } from './zoho-blog-campaign-runtime-config';

type DispatchConfiguredZohoBlogCampaignInput = Omit<
  ZohoBlogCampaignDispatchInput,
  'config'
> & {
  supabase: SupabaseClient;
};

/** Runs Zoho campaign dispatch with runtime configuration kept in the server graph. */
export function dispatchConfiguredZohoBlogCampaign({
  audience,
  context,
  fetchImpl,
  post,
  supabase,
}: DispatchConfiguredZohoBlogCampaignInput) {
  return dispatchZohoBlogCampaign({
    ...(audience ? { audience } : {}),
    config: getZohoBlogCampaignRuntimeConfig(),
    ...(context ? { context } : {}),
    ...(fetchImpl ? { fetchImpl } : {}),
    post,
    supabase,
  });
}

/** Exposes only the config required by the server content-signature route. */
export function getConfiguredZohoBlogContentConfig() {
  return getZohoBlogCampaignRuntimeConfig();
}
