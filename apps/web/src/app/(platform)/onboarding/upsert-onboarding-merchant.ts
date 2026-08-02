import type { User } from '@supabase/supabase-js';
import { getCountryByCode } from '@/lib/countries';
import type { createAdminClient as createAdminClientFactory } from '@/lib/supabase/admin';
import type {
  OnboardingBrandColors,
  OnboardingMerchant,
} from './onboarding-action-types';
import {
  hasEstablishedOnboardingSlug,
  resolveOnboardingMerchantSlug,
} from './onboarding-slug';

type OnboardingMerchantClient = Pick<
  ReturnType<typeof createAdminClientFactory>,
  'from' | 'rpc'
>;

interface UpsertOnboardingMerchantInput {
  brandColors: OnboardingBrandColors;
  brandColorsParsed: boolean;
  businessName: string;
  businessType: string;
  country: string;
  email: string;
  logoUrl?: string;
  otherBusinessType?: string;
  supabase: OnboardingMerchantClient;
  user: User;
}

export type UpsertOnboardingMerchantResult =
  | { status: 'completed'; businessName: string; merchantId: string }
  | { status: 'saved'; businessType: string; merchant: OnboardingMerchant };

export async function upsertOnboardingMerchant({
  brandColors,
  brandColorsParsed,
  businessName,
  businessType,
  country,
  email,
  logoUrl,
  otherBusinessType,
  supabase,
  user,
}: UpsertOnboardingMerchantInput): Promise<UpsertOnboardingMerchantResult> {
  const finalBusinessType =
    businessType === 'other' ? otherBusinessType || businessType : businessType;
  const payoutCurrency = getCountryByCode(country)?.currency ?? 'USD';
  const { data: existing } = await supabase
    .from('merchants')
    .select('id, business_name, slug')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing?.business_name) {
    return {
      status: 'completed',
      businessName: existing.business_name,
      merchantId: existing.id,
    };
  }

  let merchant: OnboardingMerchant | null;
  if (existing) {
    const resolvedSlug = hasEstablishedOnboardingSlug(existing.slug)
      ? null
      : await resolveOnboardingMerchantSlug(supabase, businessName);
    const { data, error } = await supabase
      .from('merchants')
      .update({
        email,
        business_name: businessName,
        business_type: finalBusinessType,
        country,
        payout_currency: payoutCurrency,
        logo_url: logoUrl,
        favicon_png_192_url: logoUrl,
        ...(brandColorsParsed ? { brand_colors: brandColors } : {}),
        ...(resolvedSlug ? { slug: resolvedSlug } : {}),
      })
      .eq('id', existing.id)
      .select('id, slug, brand_colors, hero_image_ids, logo_url')
      .single();
    if (error) throw new Error(`Failed to update merchant: ${error.message}`);
    merchant = data;
  } else {
    const slug = await resolveOnboardingMerchantSlug(supabase, businessName);
    const { data, error } = await supabase
      .from('merchants')
      .insert({
        user_id: user.id,
        email,
        business_name: businessName,
        business_type: finalBusinessType,
        country,
        payout_currency: payoutCurrency,
        logo_url: logoUrl,
        favicon_png_192_url: logoUrl,
        ...(brandColorsParsed ? { brand_colors: brandColors } : {}),
        slug,
        template_id: 'puck',
        signup_source: 'web',
      })
      .select('id, slug, brand_colors, hero_image_ids, logo_url')
      .single();
    if (error) throw new Error(`Merchant creation failed: ${error.message}`);
    merchant = data;
  }
  if (!merchant) throw new Error('Failed to create merchant record.');
  return { status: 'saved', businessType: finalBusinessType, merchant };
}
