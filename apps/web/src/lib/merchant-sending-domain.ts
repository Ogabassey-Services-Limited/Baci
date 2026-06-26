import 'server-only';

import { createClient as createAdminClient } from '@/lib/supabase/admin';

const TABLE = 'merchant_email_domains';

/**
 * Resolve a merchant's active custom sending domain (e.g. `ogabassey.com`).
 *
 * Returns the domain only when the merchant has a row that is both
 * `status = 'verified'` AND `enabled = true` — the same condition the
 * send-auth-email edge function uses to pick the auth From address. This keeps
 * transactional order mail (orders@<domain>) aligned with auth mail
 * (noreply@<domain>) for the merchants who have onboarded a custom domain.
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
      .select('domain')
      .eq('merchant_id', merchantId)
      .eq('status', 'verified')
      .eq('enabled', true)
      .maybeSingle();

    if (error || !data?.domain) {
      return null;
    }

    return data.domain as string;
  } catch (error) {
    console.error('Failed to resolve merchant sending domain:', error);
    return null;
  }
}
