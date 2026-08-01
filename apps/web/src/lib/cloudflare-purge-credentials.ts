import 'server-only';

export type CloudflarePurgeCredentials = {
  token: string;
  zoneId: string;
};

/**
 * Server-only capability for the two credentials needed to evict Cloudflare
 * storefront cache entries. Keeping this direct process-env read out of the
 * cache scheduling graph prevents ordinary blog and product mutations from
 * inheriting the generic environment module's broader authority.
 */
export function getCloudflarePurgeCredentials():
  | CloudflarePurgeCredentials
  | undefined {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();

  return token && zoneId ? { token, zoneId } : undefined;
}
