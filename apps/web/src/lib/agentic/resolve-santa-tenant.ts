import { createPublicClient } from '@/lib/supabase/public';
import { resolveAgenticMerchantId } from './agentic-merchant-id';
import { getConfiguredAgenticMerchantSlug } from './merchant-context';

export async function resolveSantaTenant(): Promise<{
  id: string;
  slug: string;
} | null> {
  const slug = getConfiguredAgenticMerchantSlug();
  if (!slug) {
    return null;
  }

  const id = await resolveAgenticMerchantId(
    createPublicClient({ clientInfo: 'baci-santa-tenant-resolve' })
  );

  return id ? { id, slug } : null;
}
