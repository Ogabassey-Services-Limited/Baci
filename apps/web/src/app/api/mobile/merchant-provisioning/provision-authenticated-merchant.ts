import type { SupabaseClient, User } from '@supabase/supabase-js';
import { normalizeBusinessName } from '@/lib/normalize-business-name';
import type { MobileMerchantProvisioningInput } from '@/schemas/mobile-merchant-provisioning';

export type MobilePlatform = 'ios' | 'android';

export interface ProvisionedMerchant {
  merchantId: string;
  merchantSlug: string;
  created: boolean;
}

export class MobileProvisioningError extends Error {
  readonly pgCode: string | null;

  constructor(pgCode: string | null) {
    super('Mobile merchant provisioning failed');
    this.name = 'MobileProvisioningError';
    this.pgCode = pgCode;
  }
}

interface ProvisionAuthenticatedMerchantOptions {
  supabase: SupabaseClient;
  user: User;
  input: MobileMerchantProvisioningInput;
  platform: MobilePlatform;
}

function parseProvisionedMerchant(value: unknown): ProvisionedMerchant | null {
  if (!Array.isArray(value) || value.length !== 1) {
    return null;
  }
  const row: unknown = value[0];
  if (
    typeof row !== 'object' ||
    row === null ||
    !('merchant_id' in row) ||
    typeof row.merchant_id !== 'string' ||
    !('merchant_slug' in row) ||
    typeof row.merchant_slug !== 'string' ||
    !('created' in row) ||
    typeof row.created !== 'boolean'
  ) {
    return null;
  }
  return {
    merchantId: row.merchant_id,
    merchantSlug: row.merchant_slug,
    created: row.created,
  };
}

export async function provisionAuthenticatedMerchant({
  supabase,
  user,
  input,
  platform,
}: ProvisionAuthenticatedMerchantOptions): Promise<ProvisionedMerchant> {
  if (!user.id) {
    throw new MobileProvisioningError(null);
  }

  const { data, error } = await supabase.rpc('provision_mobile_merchant_v2', {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone ?? '',
    p_business_name: normalizeBusinessName(input.businessName),
    p_business_type: input.businessType,
    p_other_business_type: input.otherBusinessType ?? '',
    p_country: input.country,
    p_slug: input.slug ?? '',
    p_slug_is_custom: input.slugIsCustom,
    p_logo_url: input.logoUrl ?? '',
    p_brand_colors: input.brandColors ?? null,
    p_signup_source: platform,
  });

  if (error) {
    throw new MobileProvisioningError(error.code ?? null);
  }

  const merchant = parseProvisionedMerchant(data);
  if (!merchant) {
    throw new MobileProvisioningError(null);
  }

  return merchant;
}
