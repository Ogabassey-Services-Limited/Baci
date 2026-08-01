import 'server-only';
import { getZohoBlogCampaignRuntimeConfig } from './zoho-blog-campaign-runtime-config';

/** Exposes only the config required by the server content-signature route. */
export function getConfiguredZohoBlogContentConfig() {
  const { contentSecret, publicBaseUrl } = getZohoBlogCampaignRuntimeConfig();
  return { contentSecret, publicBaseUrl };
}
