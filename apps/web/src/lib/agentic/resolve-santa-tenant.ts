import type { SupabaseClient } from '@supabase/supabase-js';
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

  return {
    id: merchant.id,
    slug: merchant.slug,
    businessName: merchant.businessName,
    agenticCheckoutEnabled:
      snapshot.status === 'found'
        ? isAgenticCheckoutEnabled(snapshot.value.feature_settings)
        : false,
  };
}
