import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export type MerchantFeatureGate =
  | 'custom_domain'
  | 'growth_integrations'
  | 'marketplace_sync';

type MerchantFeatureSource = {
  plan_expires_at?: string | null;
  plan_tier?: string | null;
  premium_features?: unknown;
};

const ALL_FEATURES = 'all_features';
const FEATURE_MESSAGES: Record<MerchantFeatureGate, string> = {
  custom_domain: 'Custom domains require Baci Starter or higher',
  growth_integrations: 'Growth integrations require Baci Pro',
  marketplace_sync: 'Marketplace sync requires Baci Pro',
};
const FEATURE_PLAN_TIERS: Record<MerchantFeatureGate, Set<string>> = {
  custom_domain: new Set(['starter', 'pro', 'business', 'enterprise']),
  growth_integrations: new Set(['pro', 'business', 'enterprise']),
  marketplace_sync: new Set(['pro', 'business', 'enterprise']),
};

export const MERCHANT_FEATURE_GATE_SELECT =
  'id, plan_tier, plan_expires_at, premium_features';

function normalizePremiumFeatures(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set();
  }

  return new Set(
    value
      .filter((feature): feature is string => typeof feature === 'string')
      .map((feature) => feature.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function merchantHasFeature(
  merchant: MerchantFeatureSource | null | undefined,
  feature: MerchantFeatureGate,
  now = new Date()
): boolean {
  const features = normalizePremiumFeatures(merchant?.premium_features);

  if (features.has(ALL_FEATURES) || features.has(feature)) {
    return true;
  }

  const featurePlanTiers = FEATURE_PLAN_TIERS[feature];
  if (!merchant?.plan_tier || !featurePlanTiers.has(merchant.plan_tier)) {
    return false;
  }

  if (!merchant.plan_expires_at) {
    return true;
  }

  const expiryTime = Date.parse(merchant.plan_expires_at);
  return Number.isFinite(expiryTime) && expiryTime > now.getTime();
}

export async function getMerchantFeatureAccess(
  supabase: SupabaseClient,
  merchantId: string,
  feature: MerchantFeatureGate
) {
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select(MERCHANT_FEATURE_GATE_SELECT)
    .eq('id', merchantId)
    .single();

  if (error || !merchant) {
    return { allowed: false, error };
  }

  return {
    allowed: merchantHasFeature(merchant, feature),
    error: null,
  };
}

export async function requireMerchantFeatureAccess(
  supabase: SupabaseClient,
  merchantId: string,
  feature: MerchantFeatureGate
): Promise<NextResponse | null> {
  const featureAccess = await getMerchantFeatureAccess(
    supabase,
    merchantId,
    feature
  );

  if (featureAccess.error) {
    console.error('Failed to verify merchant feature access:', {
      error: featureAccess.error,
      feature,
      merchantId,
    });
    return NextResponse.json(
      { error: 'Failed to verify merchant plan' },
      { status: 500 }
    );
  }

  if (!featureAccess.allowed) {
    return merchantFeatureUpgradeResponse(feature);
  }

  return null;
}

export function merchantFeatureUpgradeResponse(feature: MerchantFeatureGate) {
  return NextResponse.json(
    {
      code: 'requires_upgrade',
      error: FEATURE_MESSAGES[feature],
    },
    { status: 402 }
  );
}
