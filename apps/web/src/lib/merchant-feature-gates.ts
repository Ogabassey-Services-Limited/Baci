import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export type MerchantFeatureGate = 'custom_domain' | 'marketplace_sync';

type MerchantFeatureSource = {
  plan_expires_at?: string | null;
  plan_tier?: string | null;
  premium_features?: unknown;
};

const ALL_FEATURES = 'all_features';
const FEATURE_MESSAGES: Record<MerchantFeatureGate, string> = {
  custom_domain: 'Custom domains require Baci Pro',
  marketplace_sync: 'Marketplace sync requires Baci Pro',
};
const PAID_PLAN_TIERS = new Set(['pro', 'business', 'enterprise']);

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

  if (!merchant?.plan_tier || !PAID_PLAN_TIERS.has(merchant.plan_tier)) {
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

export function merchantFeatureUpgradeResponse(feature: MerchantFeatureGate) {
  return NextResponse.json(
    {
      code: 'requires_upgrade',
      error: FEATURE_MESSAGES[feature],
    },
    { status: 402 }
  );
}
