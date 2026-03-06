import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { BrandColors } from '@/types';
import { scheduleInitialStoreAssets } from './bootstrap';
import type { MobileOnboardingProfile } from './metadata';

interface MerchantRecord {
  id: string;
  slug: string | null;
  business_name: string | null;
  business_type: string | null;
  logo_url: string | null;
  favicon_png_192_url: string | null;
  brand_colors: BrandColors | null;
  template_id: string | null;
}

interface ProvisionMobileOnboardingOptions {
  supabase: SupabaseClient;
  user: Pick<User, 'id' | 'email'>;
  profile: MobileOnboardingProfile;
  rootDomain: string;
  defer?: (callback: () => Promise<void>) => void;
  overwriteExistingProfile?: boolean;
}

type ProvisionMobileOnboardingResult =
  | {
      success: true;
      merchant: { id: string; slug: string };
      user: { id: string; email: string };
      message: string;
    }
  | {
      success: false;
      status: number;
      body: { error: string; code?: string };
    };

function shouldReplace(
  currentValue: string | BrandColors | null,
  overwriteExistingProfile: boolean
): boolean {
  if (overwriteExistingProfile) {
    return true;
  }

  if (currentValue === null) {
    return true;
  }

  if (typeof currentValue === 'string') {
    return currentValue.trim().length === 0;
  }

  return false;
}

async function upsertOwnerStaffMember(
  supabase: SupabaseClient,
  merchantId: string,
  user: Pick<User, 'id' | 'email'>,
  fullName: string | null
) {
  if (!user.email?.trim()) {
    throw new Error('Owner account is missing an email address.');
  }

  const { data: existingStaff, error: lookupError } = await supabase
    .from('staff_members')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  const staffPayload = {
    user_id: user.id,
    merchant_id: merchantId,
    name: fullName,
    email: user.email,
    role: 'admin',
    status: 'active',
    accepted_at: new Date().toISOString(),
  };

  if (existingStaff) {
    const { error: updateError } = await supabase
      .from('staff_members')
      .update(staffPayload)
      .eq('id', existingStaff.id);

    if (updateError) {
      throw updateError;
    }
    return;
  }

  const { error: upsertError } = await supabase
    .from('staff_members')
    .upsert(staffPayload, { onConflict: 'merchant_id,email' });

  if (upsertError) {
    throw upsertError;
  }
}

export async function provisionMobileOnboarding(
  options: ProvisionMobileOnboardingOptions
): Promise<ProvisionMobileOnboardingResult> {
  const {
    supabase,
    user,
    profile,
    rootDomain,
    defer,
    overwriteExistingProfile = false,
  } = options;

  const { data: existingMerchant, error: lookupError } = await supabase
    .from('merchants')
    .select(
      'id, slug, business_name, business_type, logo_url, favicon_png_192_url, brand_colors, template_id'
    )
    .eq('user_id', user.id)
    .maybeSingle<MerchantRecord>();

  if (lookupError) {
    console.error('Merchant lookup failed:', lookupError);
    return {
      success: false,
      status: 500,
      body: { error: 'Failed to check existing account.' },
    };
  }

  const merchantPayload = {
    email: profile.email,
    business_name:
      existingMerchant &&
      !shouldReplace(existingMerchant.business_name, overwriteExistingProfile)
        ? existingMerchant.business_name
        : profile.businessName,
    business_type:
      existingMerchant &&
      !shouldReplace(existingMerchant.business_type, overwriteExistingProfile)
        ? existingMerchant.business_type
        : profile.businessType,
    logo_url:
      existingMerchant &&
      !shouldReplace(existingMerchant.logo_url, overwriteExistingProfile)
        ? existingMerchant.logo_url
        : profile.logoUrl,
    favicon_png_192_url:
      existingMerchant &&
      !shouldReplace(
        existingMerchant.favicon_png_192_url,
        overwriteExistingProfile
      )
        ? existingMerchant.favicon_png_192_url
        : profile.logoUrl,
    brand_colors:
      existingMerchant &&
      !shouldReplace(existingMerchant.brand_colors, overwriteExistingProfile)
        ? existingMerchant.brand_colors
        : profile.brandColors,
    slug:
      existingMerchant &&
      !shouldReplace(existingMerchant.slug, overwriteExistingProfile)
        ? existingMerchant.slug
        : profile.slug,
    template_id: existingMerchant?.template_id || 'puck',
  };

  const merchantQuery = existingMerchant
    ? supabase
        .from('merchants')
        .update(merchantPayload)
        .eq('id', existingMerchant.id)
    : supabase.from('merchants').insert({
        user_id: user.id,
        ...merchantPayload,
      });

  const { data: merchant, error: merchantError } = await merchantQuery
    .select('id, slug')
    .single<{ id: string; slug: string | null }>();

  if (merchantError) {
    if (merchantError.code === '23505') {
      return {
        success: false,
        status: 422,
        body: {
          error:
            'Store link is already in use. Please complete your profile to choose another one.',
          code: 'SLUG_UNAVAILABLE',
        },
      };
    }

    throw merchantError;
  }

  const merchantSlug = merchant.slug ?? merchantPayload.slug ?? profile.slug;

  const { error: domainError } = await supabase.from('domains').insert({
    merchant_id: merchant.id,
    domain: `${merchantSlug}.${rootDomain}`,
    tld: `.${rootDomain}`,
    domain_type: 'subdomain',
    status: 'active',
    is_primary: true,
  });

  if (domainError && domainError.code !== '23505') {
    console.error(
      'Domain creation failed for merchant',
      merchant.id,
      domainError
    );
    return {
      success: false,
      status: 500,
      body: { error: 'Failed to provision store domain. Please try again.' },
    };
  }

  await upsertOwnerStaffMember(supabase, merchant.id, user, profile.fullName);

  const shouldBootstrapAssets =
    overwriteExistingProfile ||
    !existingMerchant?.business_name ||
    !existingMerchant?.slug ||
    !existingMerchant?.template_id;

  if (shouldBootstrapAssets) {
    scheduleInitialStoreAssets(merchant.id, merchantSlug, profile, defer);
  }

  return {
    success: true,
    merchant: { id: merchant.id, slug: merchantSlug },
    user: { id: user.id, email: user.email ?? profile.email },
    message: 'Account created successfully',
  };
}
