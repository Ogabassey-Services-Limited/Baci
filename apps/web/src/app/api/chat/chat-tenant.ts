import type { AgenticMerchantIdentity } from '@/lib/agentic/agentic-merchant-identity';
import { resolveSantaTenant } from '@/lib/agentic/resolve-santa-tenant';
import { SANTA_MERCHANT_SLUG_HEADER } from '@/lib/agentic/santa-merchant-slug-header';

export async function resolveChatTenant(
  signal?: AbortSignal
): Promise<AgenticMerchantIdentity | null> {
  return await resolveSantaTenant(signal);
}

export function withChatTenantHeader(
  response: Response,
  merchantSlug: string
): Response {
  response.headers.set(SANTA_MERCHANT_SLUG_HEADER, merchantSlug);
  return response;
}
