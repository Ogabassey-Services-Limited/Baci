import { resolveAgenticMerchantId } from '@/lib/agentic/agentic-merchant-id';
import { getConfiguredAgenticMerchantSlug } from '@/lib/agentic/agentic-merchant-slug';
import { logger } from '@/lib/logger';
import { createAnonClient } from '@/lib/supabase/anon';

/**
 * Resolves the single agentic/copilot tenant (id + slug) for the chat surfaces.
 *
 * The chat handlers build an agentic-SCOPED Supabase client, whose construction
 * already requires the merchant id — so the id cannot be read back off that
 * client. The lookup therefore runs on a plain anon client: `slug -> id` of a
 * published store is public data under the S0-A merchants anon grant, and anon
 * keeps this off the service-role path entirely.
 *
 * Returns `null` whenever the tenant cannot be established, so every caller
 * fails closed instead of operating on an unknown merchant.
 */
export interface AgenticChatTenant {
  merchantId: string;
  merchantSlug: string;
}

export async function resolveAgenticChatTenant(): Promise<AgenticChatTenant | null> {
  // Read the configured slug BEFORE touching createAnonClient(): that factory
  // throws when the public Supabase env is missing, so checking configuration
  // first keeps the unconfigured path genuinely fail-closed rather than throwing.
  const merchantSlug = getConfiguredAgenticMerchantSlug();
  if (!merchantSlug) {
    return null;
  }

  try {
    const merchantId = await resolveAgenticMerchantId(createAnonClient());
    if (!merchantId) {
      return null;
    }

    return { merchantId, merchantSlug };
  } catch (error) {
    logger.error({
      error,
      message: 'Agentic chat tenant resolution failed',
    });
    return null;
  }
}
