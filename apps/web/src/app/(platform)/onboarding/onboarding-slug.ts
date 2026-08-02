import { logger } from '@/lib/logger';
import type { createAdminClient as createAdminClientFactory } from '@/lib/supabase/admin';

function buildOnboardingMerchantSlug(businessName: string): string {
  return (
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'store'
  );
}

type SlugResolverClient = Pick<
  ReturnType<typeof createAdminClientFactory>,
  'rpc'
>;

export async function resolveOnboardingMerchantSlug(
  supabase: SlugResolverClient,
  businessName: string
): Promise<string> {
  const fallbackSlug = buildOnboardingMerchantSlug(businessName);
  const { data, error } = await supabase.rpc('generate_slug', {
    text_input: businessName,
  });
  if (error) {
    logger.warn({
      message: 'Failed to generate unique merchant slug',
      businessName,
      error,
    });
    return fallbackSlug;
  }
  return typeof data === 'string' && data.trim() ? data : fallbackSlug;
}

export function hasEstablishedOnboardingSlug(
  slug: string | null | undefined
): boolean {
  return typeof slug === 'string' && slug.trim().length > 0;
}
