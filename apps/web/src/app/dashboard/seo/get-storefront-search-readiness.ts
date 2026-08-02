import { cookies } from 'next/headers';
import {
  ensurePermission,
  MerchantAuthenticationRequiredError,
} from '@/lib/merchant-server';
import { buildHomeSeoDecision } from '@/lib/storefront-seo/build-home-seo-decision';
import { createClient } from '@/lib/supabase/server';
import { buildStorefrontSearchReadinessAssessment } from './build-storefront-search-readiness-assessment';

async function countRows(
  query: PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>
): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getStorefrontSearchReadiness(merchantId: string) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new MerchantAuthenticationRequiredError();

  const { merchant } = await ensurePermission('marketing', 'view');
  if (merchant.id !== merchantId) throw new Error('Merchant mismatch');

  const [
    merchantResult,
    activeProducts,
    missingDescriptions,
    missingImages,
    missingCategoryDescriptions,
  ] = await Promise.all([
    supabase
      .from('merchants')
      .select(
        'is_published, site_description, site_tagline, support_email, support_phone, trust_profile'
      )
      .eq('id', merchant.id)
      .maybeSingle(),
    countRows(
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
    ),
    countRows(
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .is('description', null)
    ),
    countRows(
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .is('image', null)
    ),
    countRows(
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('is_active', true)
        .is('description', null)
    ),
  ]);

  if (merchantResult.error || !merchantResult.data) {
    throw new Error(merchantResult.error?.message ?? 'Merchant not found');
  }

  const merchantFacts = merchantResult.data;
  return buildStorefrontSearchReadinessAssessment({
    homeIndexable: buildHomeSeoDecision({
      isStorePublished: merchantFacts.is_published === true,
      canonicalUrl: 'https://storefront.invalid',
    }).index,
    hasStoreCopy: Boolean(
      merchantFacts.site_description?.trim() ||
        merchantFacts.site_tagline?.trim()
    ),
    hasSupportDetails: Boolean(
      merchantFacts.support_email?.trim() || merchantFacts.support_phone?.trim()
    ),
    hasPolicies: Boolean(merchantFacts.trust_profile),
    activeProductCount: activeProducts,
    missingProductDescriptionCount: missingDescriptions,
    missingProductImageCount: missingImages,
    missingCategoryIntroductionCount: missingCategoryDescriptions,
  });
}
