import { cookies } from 'next/headers';
import {
  ensurePermission,
  MerchantAuthenticationRequiredError,
} from '@/lib/merchant-server';
import { buildStoreUrl } from '@/lib/store-url';
import { buildHomeSeoDecision } from '@/lib/storefront-seo/build-home-seo-decision';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { createClient } from '@/lib/supabase/server';
import { buildStorefrontSearchReadinessAssessment } from './build-storefront-search-readiness-assessment';
import { hasPublishableTrustPolicy } from './has-publishable-trust-policy';

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
        'business_name, is_published, slug, custom_domain, site_description, site_tagline, support_email, support_phone, trust_profile'
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
        .or('description.is.null,description.eq.')
    ),
    countRows(
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .or('images.is.null,images.eq.[]')
    ),
    countRows(
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('is_active', true)
        .or('description.is.null,description.eq.')
    ),
  ]);

  if (merchantResult.error || !merchantResult.data) {
    throw new Error(merchantResult.error?.message ?? 'Merchant not found');
  }

  const merchantFacts = merchantResult.data;
  const canonicalUrl = merchantFacts.slug?.trim()
    ? buildStoreUrl({
        slug: merchantFacts.slug,
        custom_domain: merchantFacts.custom_domain,
      })
    : null;
  return buildStorefrontSearchReadinessAssessment({
    homeDecision: buildHomeSeoDecision({
      isPublished: merchantFacts.is_published === true,
      canonicalUrl,
      merchantName: merchantFacts.business_name ?? null,
    }),
    hasCustomStoreDescription: Boolean(
      merchantFacts.site_description?.trim() ||
        merchantFacts.site_tagline?.trim()
    ),
    hasPublicSupportContact: Boolean(
      merchantFacts.support_email?.trim() || merchantFacts.support_phone?.trim()
    ),
    hasPublishedTrustPolicy: hasPublishableTrustPolicy(
      buildMerchantTrustProfile({
        trust_profile: merchantFacts.trust_profile,
      })
    ),
    activeProductCount: activeProducts,
    productsMissingDescriptionCount: missingDescriptions,
    productsMissingImageCount: missingImages,
    categoriesMissingCustomIntroCount: missingCategoryDescriptions,
  });
}
