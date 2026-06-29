import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { hasCustomEmailDomainEntitlement } from '@/lib/feature-flags';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';

export type ResolvedMerchant = {
  merchantId: string;
  planTier: string | null;
  slug: string | null;
  planExpiresAt: string | null;
  premiumFeatures: unknown;
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
    .select('plan_tier, slug, plan_expires_at, premium_features')
    .eq('id', ctx.merchantId)
    .single();
  // A real read failure is a server error, not an authorization denial. With
  // `.single()`, a genuinely missing row surfaces as PGRST116 — treat only that
  // (and a null row) as the 403 not-found/unauthorized case.
  if (error && error.code !== 'PGRST116') {
    return {
      error: NextResponse.json(
        {
          error: 'Failed to load merchant access',
          code: 'merchant_lookup_failed',
        },
        { status: 500 }
      ),
    };
  }
  if (!merchant) {
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
    planExpiresAt: (merchant.plan_expires_at as string | null) ?? null,
    premiumFeatures: merchant.premium_features ?? null,
  };
}

/** 403 response if the merchant's plan lacks the custom-email-domain feature. */
export function emailDomainGate(
  resolved: ResolvedMerchant
): NextResponse | null {
  if (
    !hasCustomEmailDomainEntitlement({
      plan_tier: resolved.planTier,
      plan_expires_at: resolved.planExpiresAt,
      premium_features: resolved.premiumFeatures,
    })
  ) {
    return NextResponse.json(
      { error: 'Upgrade your plan to send from a custom email domain.' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Auth → merchant resolution → plan gate for the email-domain route handlers.
 * Returns `{ error }` (a 401/403/5xx response) to short-circuit, or the
 * resolved merchant plus the authenticated supabase client and user id.
 * Shared by both the register/enable route and the verify route.
 */
export async function resolveEmailDomainRequest(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!(auth.user && auth.supabase)) {
    return {
      error: NextResponse.json(
        { error: auth.error ?? 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  const resolved = await resolveMerchantForEmailDomain(
    auth.supabase,
    auth.user.id
  );
  if ('error' in resolved) {
    return resolved;
  }
  const denied = emailDomainGate(resolved);
  if (denied) {
    return { error: denied };
  }
  return { ...resolved, supabase: auth.supabase, userId: auth.user.id };
}
