import { createPublicClient } from '@/lib/supabase/public';
import { resolveAgenticMerchantIdentity } from './agentic-merchant-identity';
import { getConfiguredAgenticMerchantSlug } from './agentic-merchant-slug';

export async function resolveSantaTenant(signal?: AbortSignal): Promise<{
  id: string;
  slug: string;
  businessName: string | null;
} | null> {
  if (!getConfiguredAgenticMerchantSlug()) {
    return null;
  }

  const merchant = await resolveAgenticMerchantIdentity(
    createPublicClient({
      clientInfo: 'baci-santa-tenant-resolve',
      // This publication-gated lookup must leave enough time for the provider
      // chain to finish before the route's 30s platform budget expires.
      timeoutMs: 4000,
      ...(signal ? { signal } : {}),
    })
  );

  return merchant
    ? {
        id: merchant.id,
        slug: merchant.slug,
        businessName: merchant.businessName,
      }
    : null;
}
