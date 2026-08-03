import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
import { readStorefrontMerchantSnapshot } from '@/lib/storefront-merchant-snapshot';
import { createPublicClient } from '@/lib/supabase/public';
import type { StorefrontDatabase } from '@/types/storefront-database';
import type { AgenticMerchantIdentity } from './agentic-merchant-identity';
import { resolveAgenticMerchantIdentity } from './agentic-merchant-identity';
import { getConfiguredAgenticMerchantSlug } from './agentic-merchant-slug';

function isAgenticCheckoutEnabled(featureSettings: unknown): boolean {
  if (
    featureSettings === null ||
    typeof featureSettings !== 'object' ||
    Array.isArray(featureSettings)
  ) {
    return true;
  }

  return (
    (featureSettings as { agentic_checkout_enabled?: unknown })
      .agentic_checkout_enabled !== false
  );
}

function readSnapshotMerchantData(value: unknown): {
  country: string | null;
  id: string;
  payout_currency: string | null;
  slug: string;
} | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;
  if (typeof data.id !== 'string' || typeof data.slug !== 'string') {
    return null;
  }

  return {
    country: typeof data.country === 'string' ? data.country : null,
    id: data.id,
    payout_currency:
      typeof data.payout_currency === 'string' ? data.payout_currency : null,
    slug: data.slug,
  };
}

export async function resolveSantaTenant(
  signal?: AbortSignal
): Promise<AgenticMerchantIdentity | null> {
  if (!getConfiguredAgenticMerchantSlug()) {
    return null;
  }

  const publicClient = createPublicClient({
    clientInfo: 'baci-santa-tenant-resolve',
    // These publication-gated lookups must leave enough time for the provider
    // chain to finish before the route's 30s platform budget expires.
    timeoutMs: 4000,
    ...(signal ? { signal } : {}),
  }) as unknown as SupabaseClient<StorefrontDatabase>;
  const merchant = await resolveAgenticMerchantIdentity(publicClient);

  if (!merchant) {
    return null;
  }

  // The base feature-settings table is intentionally not readable by anon.
  // Use the bounded public snapshot so the checkout kill switch is revalidated
  // on every chat request without pulling secret-bearing settings.
  const snapshot = await readStorefrontMerchantSnapshot(
    publicClient,
    merchant.slug
  );

  if (snapshot.status === 'not_found') {
    return null;
  }

  if (snapshot.status === 'found') {
    const snapshotMerchant = readSnapshotMerchantData(
      snapshot.value.merchant_data
    );
    if (
      !snapshotMerchant ||
      snapshotMerchant.id !== merchant.id ||
      snapshotMerchant.slug !== merchant.slug
    ) {
      return null;
    }

    return {
      ...merchant,
      currency: resolveMerchantCurrencyConfig(snapshotMerchant),
      agenticCheckoutEnabled: isAgenticCheckoutEnabled(
        snapshot.value.feature_settings
      ),
    };
  }

  return {
    id: merchant.id,
    slug: merchant.slug,
    businessName: merchant.businessName,
    currency: merchant.currency,
    agenticCheckoutEnabled: false,
  };
}
