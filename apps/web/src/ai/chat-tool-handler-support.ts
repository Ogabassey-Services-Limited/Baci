import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgenticMerchantIdentity } from '@/lib/agentic/agentic-merchant-identity';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';

export type ChatToolSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;

export function createChatToolSupabaseClient(
  merchant: AgenticMerchantIdentity,
  sessionId?: string
): ChatToolSupabaseClient {
  return createAgenticScopedSupabaseClient({
    merchantId: merchant.id,
    merchantSlug: merchant.slug,
    sessionId,
  });
}
