import { DEFAULT_CURATED_BRAND_COLORS } from '@/lib/storefront-defaults/default-curated-brand-colors';
import { parseBrandColors } from '@/schemas/brand-colors';
import type { BrandColors } from '@/types';

interface MobileMerchantStarterFactsInput {
  merchantId: string;
  ownerUserId: string;
  supabase: {
    from: (table: string) => unknown;
  };
}

interface MerchantStarterFactsQuery {
  select: (columns: string) => {
    eq: (
      column: 'id',
      value: string
    ) => {
      eq: (
        column: 'user_id',
        value: string
      ) => {
        maybeSingle: () => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export interface MobileMerchantStarterFacts {
  brandColors: BrandColors;
  businessName: string;
  businessType: string;
  merchantId: string;
  merchantLogoUrl: string | null;
  merchantSlug: string;
}

class MobileMerchantStarterFactsError extends Error {
  constructor() {
    super('Could not load persisted store setup.');
    this.name = 'MobileMerchantStarterFactsError';
  }
}

function valueOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function loadMobileMerchantStarterFacts({
  merchantId,
  ownerUserId,
  supabase,
}: MobileMerchantStarterFactsInput): Promise<MobileMerchantStarterFacts> {
  const merchants = supabase.from('merchants') as MerchantStarterFactsQuery;
  const { data, error } = await merchants
    .select('id, business_name, business_type, slug, logo_url, brand_colors')
    .eq('id', merchantId)
    .eq('user_id', ownerUserId)
    .maybeSingle();
  if (error || typeof data !== 'object' || data === null)
    throw new MobileMerchantStarterFactsError();

  const row = data as Record<string, unknown>;
  const persistedId = valueOrNull(row.id);
  const businessName = valueOrNull(row.business_name);
  const businessType = valueOrNull(row.business_type);
  const merchantSlug = valueOrNull(row.slug);
  if (
    persistedId !== merchantId ||
    !businessName ||
    !businessType ||
    !merchantSlug
  )
    throw new MobileMerchantStarterFactsError();

  return {
    merchantId: persistedId,
    merchantSlug,
    businessName,
    businessType,
    merchantLogoUrl: valueOrNull(row.logo_url),
    brandColors:
      parseBrandColors(row.brand_colors) ?? DEFAULT_CURATED_BRAND_COLORS,
  };
}
