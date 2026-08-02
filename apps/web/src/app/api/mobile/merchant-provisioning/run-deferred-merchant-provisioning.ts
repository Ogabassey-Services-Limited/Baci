import type { SupabaseClient } from '@supabase/supabase-js';
import { generateInitialTemplate } from '@/lib/initial-template-generator';
import { normalizeBusinessName } from '@/lib/normalize-business-name';
import type { BrandColors } from '@/types';

const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#000000',
  background: '#ffffff',
  accent: '#f59e0b',
};

interface DeferredMerchantProvisioningInput {
  supabase: SupabaseClient;
  merchantId: string;
  merchantSlug: string;
  businessName: string;
  businessType: string;
  brandColors: BrandColors | null;
}

function getPostgresCode(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return null;
}

function logDeferredFailure(
  stage: 'template_generation' | 'page_config_insert',
  merchantId: string,
  error: unknown
): void {
  console.error(
    'mobile-merchant-provisioning %s',
    'deferred_failure',
    JSON.stringify({
      stage,
      merchantId,
      pgCode: getPostgresCode(error),
    })
  );
}

export async function runDeferredMerchantProvisioning({
  supabase,
  merchantId,
  merchantSlug,
  businessName,
  businessType,
  brandColors,
}: DeferredMerchantProvisioningInput): Promise<void> {
  let config: Awaited<ReturnType<typeof generateInitialTemplate>>;
  try {
    config = await generateInitialTemplate({
      businessName: normalizeBusinessName(businessName),
      businessType,
      brandColors: brandColors ?? DEFAULT_BRAND_COLORS,
      merchant: { id: merchantId, slug: merchantSlug },
    });
  } catch (error) {
    logDeferredFailure('template_generation', merchantId, error);
    return;
  }

  const { error } = await supabase.from('page_configs').insert({
    merchant_id: merchantId,
    page_slug: 'home',
    page_name: 'Home',
    draft_config: config,
    published_config: config,
    is_published: true,
  });

  if (error && getPostgresCode(error) !== '23505') {
    logDeferredFailure('page_config_insert', merchantId, error);
  }
}
