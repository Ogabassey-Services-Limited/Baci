import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { StorefrontDomainOwnershipRow } from '@/lib/merchant-email-domain-shared';
import { vercel } from '@/lib/vercel';

function isVercelDomainVerified(
  verification: Awaited<ReturnType<typeof vercel.verifyDomain>>
) {
  return (
    verification.verified === true &&
    (!verification.verification || verification.verification.length === 0)
  );
}

async function firstVerifiedVercelDomain(
  rows: StorefrontDomainOwnershipRow[]
): Promise<StorefrontDomainOwnershipRow | null> {
  for (const row of rows) {
    try {
      const verification = await vercel.verifyDomain(row.domain);
      if (isVercelDomainVerified(verification)) {
        return row;
      }
    } catch {
      // Fail closed: a Vercel/API error means the local `domains` row is not a
      // sufficient proof of sender ownership for self-serve email domains.
    }
  }
  return null;
}

/**
 * Prove the merchant controls the EXACT sender domain before it may be used for
 * email: it must be an active+verified storefront domain (custom/purchased) on
 * `public.domains` AND pass live Vercel verification. Throws otherwise.
 */
export async function assertMerchantOwnsVerifiedStorefrontDomain(
  supabase: SupabaseClient,
  merchantId: string,
  domain: string
) {
  // Require an active+verified row for the EXACT sender domain. Do NOT accept a
  // www↔apex counterpart: verifying www.example.com does not prove control of
  // example.com (e.g. a delegated subdomain), and registration sends ZeptoMail
  // the submitted domain — so accepting the counterpart would let a merchant
  // reserve a sender domain they haven't actually verified.
  const { data, error } = await supabase
    .from('domains')
    .select('id, domain, domain_type')
    .eq('merchant_id', merchantId)
    .eq('domain', domain.toLowerCase())
    .eq('status', 'active')
    .in('domain_type', ['custom', 'purchased']);
  if (error) {
    throw new Error(`Failed to load storefront domain: ${error.message}`);
  }
  const rows = (data ?? []) as StorefrontDomainOwnershipRow[];
  if (rows.length === 0) {
    throw new Error(
      'Domain must be an active verified storefront domain before email sending can be configured'
    );
  }

  // Baci-purchased domains are registrar-backed by us: an active 'purchased'
  // row is itself proof of ownership, and they are NOT added to the Vercel
  // project, so Vercel verification would always fail for them. Only BYOD
  // ('custom') domains need live Vercel verification.
  if (rows.some((row) => row.domain_type === 'purchased')) {
    return;
  }

  const verifiedDomain = await firstVerifiedVercelDomain(rows);
  if (!verifiedDomain) {
    throw new Error(
      'Domain must be an active verified storefront domain before email sending can be configured'
    );
  }
}
