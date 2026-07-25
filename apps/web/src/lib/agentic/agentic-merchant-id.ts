import type { SupabaseClient } from '@supabase/supabase-js';
import { getConfiguredAgenticMerchantSlug } from './merchant-context';

/**
 * Resolves the single agentic/copilot tenant's merchant id from the configured
 * `BACI_AGENTIC_MERCHANT_SLUG` (legacy alias `OPENAI_AGENTIC_MERCHANT_SLUG`).
 *
 * Replaces the Ogabassey merchant UUID that was hardcoded in the chat/copilot
 * surfaces: a literal id silently binds this code to one production row, breaks
 * every non-production environment, and cannot be repointed without a deploy.
 *
 * Returns `null` when the slug is unset or resolves to no merchant, so callers
 * fail closed rather than operating on an unknown tenant.
 */

// The chat surfaces pass differently-shaped clients (agentic-scoped,
// service-role, or injected test doubles). `Pick<SupabaseClient, 'from'>` is the
// convention already used by chat-tool-handlers.ts / chat-order-cancellation.ts
// and avoids re-deriving Supabase's deep builder generics here.
type MerchantIdLookupClient = Pick<SupabaseClient, 'from'>;

const merchantIdBySlug = new Map<string, string>();

/** Test-only: clears the memoized slug -> id mapping. */
export function resetAgenticMerchantIdCache(): void {
  merchantIdBySlug.clear();
}

export async function resolveAgenticMerchantId(
  client: MerchantIdLookupClient
): Promise<string | null> {
  const slug = getConfiguredAgenticMerchantSlug();
  if (!slug) {
    return null;
  }

  const cached = merchantIdBySlug.get(slug);
  if (cached) {
    return cached;
  }

  // Single-tenant and stable, so memoize per slug rather than hitting the DB on
  // every copilot turn. Only `id` is selected — no secret columns.
  const { data, error } = await client
    .from('merchants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle<{ id: string }>();

  if (error || !data?.id) {
    return null;
  }

  merchantIdBySlug.set(slug, data.id);
  return data.id;
}
