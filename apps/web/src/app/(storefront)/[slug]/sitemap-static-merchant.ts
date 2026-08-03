import type { MerchantTrustProfileSource } from '@/lib/storefront-trust/merchant-trust-profile-types';

export type SitemapStaticMerchant = MerchantTrustProfileSource & {
  business_name?: string | null;
  is_published?: boolean | null;
  slug: string;
  updated_at?: string | null;
};
