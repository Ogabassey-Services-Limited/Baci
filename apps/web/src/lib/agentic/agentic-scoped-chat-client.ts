import { resolveAgenticChatTenant } from '@/lib/agentic/agentic-chat-tenant';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';

type AgenticScopedSupabaseClient = ReturnType<
  typeof createAgenticScopedSupabaseClient
>;

export interface AgenticScopedChatClient {
  merchantId: string;
  supabase: AgenticScopedSupabaseClient;
}

/**
 * Builds the agentic-scoped Supabase client used by the chat/copilot handlers,
 * with the tenant resolved from `BACI_AGENTIC_MERCHANT_SLUG` instead of a
 * hardcoded merchant UUID.
 *
 * Returns `null` when the tenant cannot be resolved so callers fail closed.
 * Deliberately does NOT swallow errors thrown by the scoped-client factory —
 * an unusable scope is a real failure and must surface to the caller's own
 * error handling rather than be reported as "tenant not configured".
 */
export async function createAgenticScopedChatClient(
  sessionId?: string
): Promise<AgenticScopedChatClient | null> {
  const tenant = await resolveAgenticChatTenant();
  if (!tenant) {
    return null;
  }

  const { merchantId, merchantSlug } = tenant;
  // Build the scope conditionally: the order-cancellation path has no chat
  // session and must not carry a session key at all, while the chat tools do.
  const scope =
    sessionId === undefined
      ? { merchantId, merchantSlug }
      : { merchantId, merchantSlug, sessionId };

  return {
    merchantId,
    supabase: createAgenticScopedSupabaseClient(scope),
  };
}
