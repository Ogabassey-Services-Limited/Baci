import 'server-only';

import { FEATURES, isPlanTier, planHasFeature } from '@/lib/feature-flags';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

const TABLE = 'merchant_email_domains';

interface SendingDomainRow {
  domain: string | null;
  merchants:
    | { plan_tier: string | null }
    | { plan_tier: string | null }[]
    | null;
}

function planTierOf(row: SendingDomainRow): string | null {
  const rel = row.merchants;
  if (Array.isArray(rel)) {
    return rel[0]?.plan_tier ?? null;
  }
  return rel?.plan_tier ?? null;
}

function domainOwnershipCandidates(domain: string): string[] {
  const normalized = domain.toLowerCase();
  return normalized.startsWith('www.')
    ? [normalized, normalized.slice(4)]
    : [normalized, `www.${normalized}`];
}

async function merchantStillOwnsActiveStorefrontDomain(
  supabase: ReturnType<typeof createAdminClient>,
  merchantId: string,
  domain: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('domains')
    .select('id')
    .eq('merchant_id', merchantId)
    .in('domain', domainOwnershipCandidates(domain))
    .eq('status', 'active')
    .limit(1);

  if (error) {
    console.error('Failed to verify merchant sending domain ownership:', error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

/**
 * Resolve a merchant's active custom sending domain (e.g. `ogabassey.com`).
 *
 * Returns the domain only when the merchant has a row that is both
 * `status = 'verified'` AND `enabled = true` AND the merchant's plan still
 * carries the `custom_email_domain` entitlement AND the domain is still an
 * active storefront domain owned by the merchant — the same gate the
 * send-auth-email edge function applies. The plan check guards against a
 * merchant enabling the feature on Pro and later downgrading, while the active
 * storefront-domain check closes the stale-row gap when a domain is removed or
 * transferred after the email-domain row was verified.
 *
 * Reads through the service-role client because transactional sends run in
 * webhook/cron contexts with no user session. Fails open (returns `null`) so a
 * lookup error never blocks an order email — the sender simply falls back to
 * the platform domain.
 */
export async function getActiveMerchantSendingDomain(
  merchantId: string | null | undefined
): Promise<string | null> {
  if (!merchantId) {
    return null;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select('domain, merchants!inner(plan_tier)')
      .eq('merchant_id', merchantId)
      .eq('status', 'verified')
      .eq('enabled', true)
      .maybeSingle<SendingDomainRow>();

    if (error || !data?.domain) {
      return null;
    }

    const planTier = planTierOf(data);
    if (
      !isPlanTier(planTier) ||
      !planHasFeature(planTier, FEATURES.CUSTOM_EMAIL_DOMAIN)
    ) {
      return null;
    }

    const stillOwnsDomain = await merchantStillOwnsActiveStorefrontDomain(
      supabase,
      merchantId,
      data.domain
    );
    if (!stillOwnsDomain) {
      return null;
    }

    return data.domain;
  } catch (error) {
    console.error('Failed to resolve merchant sending domain:', error);
    return null;
  }
}
