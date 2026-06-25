import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hasCustomEmailDomainEntitlement } from '@/lib/feature-flags';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';

export type ResolvedMerchant = {
  merchantId: string;
  planTier: string | null;
  slug: string | null;
};

/**
 * Auth + merchant resolution for the email-domain routes. Returns a 401/403
 * response to short-circuit, or the resolved merchant (id, plan, slug).
 */
export async function resolveMerchantForEmailDomain(
  supabase: SupabaseClient,
  authenticatedUserId?: string
): Promise<{ error: NextResponse } | ResolvedMerchant> {
  let userId = authenticatedUserId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }
    userId = user.id;
  }
  const ctx = await getMerchantForApiRequest(supabase, userId);
  if (!ctx) {
    return {
      error: NextResponse.json({ error: 'No merchant found' }, { status: 403 }),
    };
  }
  if (!ctx.staffAccess.isOwner) {
    return {
      error: NextResponse.json(
        { error: 'Only merchant owners can manage email domains' },
        { status: 403 }
      ),
    };
  }
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('plan_tier, slug')
    .eq('id', ctx.merchantId)
    .single();
  if (error || !merchant) {
    return {
      error: NextResponse.json(
        { error: 'Merchant access unavailable' },
        { status: 403 }
      ),
    };
  }

  return {
    merchantId: ctx.merchantId,
    planTier: (merchant.plan_tier as string | null) ?? null,
    slug: (merchant.slug as string | null) ?? ctx.merchantSlug ?? null,
  };
}

/** 403 response if the merchant's plan lacks the custom-email-domain feature. */
export function emailDomainGate(
  resolved: ResolvedMerchant
): NextResponse | null {
  if (!hasCustomEmailDomainEntitlement(resolved.planTier, resolved.slug)) {
    return NextResponse.json(
      { error: 'Upgrade your plan to send from a custom email domain.' },
      { status: 403 }
    );
  }
  return null;
}
